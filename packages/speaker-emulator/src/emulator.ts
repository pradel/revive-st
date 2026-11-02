import { createServer } from "node:http";

import { NodeHttpServer, NodeSocketServer } from "@effect/platform-node";
import type { ContentItem } from "bose-api-speaker-client";
import {
  Context,
  Deferred,
  Effect,
  FiberHandle,
  Latch,
  Layer,
  Option,
  PubSub,
  Ref,
} from "effect";
import {
  FetchHttpClient,
  HttpRouter,
  type HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import type { NetAddress } from "effect/net";
import { Socket } from "effect/socket";

import { type Exchange, makeCloud } from "./cloud.ts";
import { SERVER_URL_FIELDS, type SpeakerConfig } from "./config.ts";
import {
  AUX_CONTENT_ITEM,
  initialState,
  LOCAL_SOURCES,
  type SpeakerState,
} from "./state.ts";
import {
  bassXml,
  configurationReply,
  errorsXml,
  type Identity,
  infoXml,
  isSourcesUpdated,
  networkInfoXml,
  nowPlayingXml,
  nowSelectionUpdated,
  presetsXml,
  readAccountId,
  readBass,
  readContentItem,
  readKey,
  readName,
  readStoredPreset,
  readVolume,
  SDK_INFO_XML,
  sourcesXml,
  statusXml,
  volumeUpdated,
  volumeXml,
} from "./xml.ts";

const HOST = "127.0.0.1";

export interface SpeakerPorts {
  /** The speaker's API, 8090 on a real one. */
  readonly http: number;
  /** WebSocket notifications (`gabbo`), 8080 on a real one. */
  readonly notifications: number;
  /** The TAP console, 17000 on a real one. */
  readonly console: number;
}

const portOf = (address: NetAddress.SocketAddress) =>
  address._tag === "UnixPathAddress" ? 0 : address.port;

/**
 * A SoundTouch speaker on 127.0.0.1: its API, its WebSocket notifications
 * and its TAP console on ports of their own, and the requests it makes to
 * the servers its configuration names when it restarts, is paired, renamed,
 * stores a preset or plays a station.
 */
export class SpeakerEmulator extends Context.Service<
  SpeakerEmulator,
  {
    readonly deviceId: string;
    readonly host: string;
    readonly ports: SpeakerPorts;
    readonly state: Effect.Effect<SpeakerState>;
    /** Every request the speaker made to a server, in order. */
    readonly exchanges: Effect.Effect<readonly Exchange[]>;
    /** Open WebSocket connections receiving notifications. */
    readonly listeners: Effect.Effect<number>;
    /** Restarts it as `sys reboot` does; resolves once it is back and booted. */
    readonly reboot: Effect.Effect<void>;
    /** Resolves once its latest restart, if any, is done calling its servers. */
    readonly booted: Effect.Effect<void>;
  }
>()("@revive-st/speaker-emulator/SpeakerEmulator") {
  static readonly layer = (config: SpeakerConfig) =>
    Layer.effect(SpeakerEmulator, make(config));
}

const make = Effect.fnUntraced(function* (config: SpeakerConfig) {
  const scope = yield* Effect.scope;
  const { deviceId } = config;
  const identity: Identity = {
    deviceId,
    type: config.type ?? "SoundTouch 10",
    ipAddress: HOST,
  };
  const state = yield* Ref.make(initialState(config));
  const exchanges = yield* Ref.make<readonly Exchange[]>([]);
  const notifications = yield* PubSub.unbounded<string>();
  const notify = (xml: string) =>
    Effect.asVoid(PubSub.publish(notifications, xml));
  const listeners = yield* Ref.make(0);
  /** Open while the speaker is up; requests wait on it while it restarts. */
  const up = yield* Latch.make(true);
  /** Completed when the speaker goes down, dropping its connections. */
  const goingDown = yield* Ref.make(yield* Deferred.make<undefined>());
  const bootDone = yield* Ref.make(yield* Deferred.make<undefined>());
  yield* Deferred.succeed(yield* Ref.get(bootDone), undefined);
  const playback = yield* FiberHandle.make();

  const cloud = yield* makeCloud({ identity, state, exchanges, notify }).pipe(
    Effect.provide(FetchHttpClient.layer),
  );

  // -------------------------------------------------------------------------
  // Restart

  const restart = Effect.fnUntraced(function* (
    done: Deferred.Deferred<undefined>,
  ) {
    yield* Effect.sleep(config.shutdownDelay ?? "50 millis");
    yield* Ref.update(state, (current) => ({ ...current, up: false }));
    yield* up.close;
    yield* FiberHandle.clear(playback);
    yield* Deferred.succeed(yield* Ref.get(goingDown), undefined);
    yield* Effect.sleep(config.restartDelay ?? "100 millis");
    yield* Ref.set(goingDown, yield* Deferred.make<undefined>());
    yield* Ref.update(state, (current): SpeakerState => ({
      ...current,
      up: true,
      running: current.saved,
      margeAccountUUID: current.pendingAccountId ?? current.margeAccountUUID,
      pendingAccountId: undefined,
      activeSourceTypes: current.savedSourceTypes,
      nowPlaying: { kind: "standby" },
    }));
    yield* up.open;
    yield* cloud.boot;
    yield* Deferred.succeed(done, undefined);
  });

  const startRestart = Effect.gen(function* () {
    const done = yield* Deferred.make<undefined>();
    yield* Ref.set(bootDone, done);
    yield* Effect.forkIn(restart(done), scope);
    return done;
  });

  // -------------------------------------------------------------------------
  // Playing

  const play = Effect.fnUntraced(function* (
    contentItem: ContentItem,
    presetId: number,
  ) {
    yield* Ref.update(state, (current) => ({
      ...current,
      lastPlayed: contentItem,
    }));
    yield* notify(nowSelectionUpdated(deviceId, presetId, contentItem));
    yield* FiberHandle.clear(playback);
    if (LOCAL_SOURCES.some(({ source }) => source === contentItem.source)) {
      yield* cloud.setNowPlaying({
        kind: "playing",
        contentItem,
        playStatus: "PLAY_STATE",
        stationName: "",
        art: "",
        streamUrl: "",
      });
      return;
    }
    // A speaker accepts any station at once, then asks its server for the stream.
    yield* cloud.setNowPlaying({
      kind: "playing",
      contentItem,
      playStatus: "BUFFERING_STATE",
      stationName: contentItem.itemName,
      art: contentItem.containerArt,
      streamUrl: "",
    });
    yield* FiberHandle.run(playback, cloud.resolveStation(contentItem));
  });

  const pressKey = Effect.fnUntraced(function* (key: string) {
    const current = yield* Ref.get(state);
    const presetSlot = /^PRESET_([1-6])$/.exec(key);
    if (presetSlot) {
      const presetId = Number(presetSlot[1]);
      const preset = current.presets.find(({ id }) => id === presetId);
      if (preset) {
        yield* play(preset.contentItem, presetId);
      }
      return;
    }
    if (key === "POWER") {
      if (current.nowPlaying.kind === "standby") {
        yield* play(current.lastPlayed ?? AUX_CONTENT_ITEM, 0);
      } else {
        yield* FiberHandle.clear(playback);
        yield* cloud.setNowPlaying({ kind: "standby" });
      }
    } else if (key === "MUTE") {
      const muted = yield* Ref.updateAndGet(state, (before) => ({
        ...before,
        muted: !before.muted,
      }));
      yield* notify(volumeUpdated(deviceId, muted));
    } else if (key === "PLAY" || key === "PAUSE" || key === "PLAY_PAUSE") {
      const { nowPlaying } = current;
      if (
        nowPlaying.kind === "playing" &&
        nowPlaying.playStatus !== "BUFFERING_STATE"
      ) {
        const playStatus =
          key === "PLAY" ||
          (key === "PLAY_PAUSE" && nowPlaying.playStatus === "PAUSE_STATE")
            ? "PLAY_STATE"
            : "PAUSE_STATE";
        yield* cloud.setNowPlaying({ ...nowPlaying, playStatus });
      }
    }
  });

  // -------------------------------------------------------------------------
  // Port 8090

  const xml = (body: string, status = 200) =>
    HttpServerResponse.text(body, { status, contentType: "text/xml" });

  const accepted = (path: string) => Effect.succeed(xml(statusXml(path)));

  const read = (
    path: `/${string}`,
    render: (current: SpeakerState) => string,
  ) =>
    HttpRouter.route(
      "GET",
      path,
      Effect.map(Ref.get(state), (current) => xml(render(current))),
    );

  /** A POST whose body `parse` reads; `handle` runs with what it read. */
  const write = <Body>(
    path: `/${string}`,
    parse: (body: string) => Body | undefined,
    handle: (
      body: Body,
    ) => Effect.Effect<HttpServerResponse.HttpServerResponse>,
  ) =>
    HttpRouter.route(
      "POST",
      path,
      (request: HttpServerRequest.HttpServerRequest) =>
        request.text.pipe(
          Effect.map(parse),
          Effect.orElseSucceed(() => undefined),
          Effect.flatMap((body) =>
            body === undefined
              ? Effect.succeed(
                  xml(
                    errorsXml(deviceId, {
                      value: 1019,
                      name: "CLIENT_XML_ERROR",
                      message: `Unreadable ${path} request`,
                    }),
                    400,
                  ),
                )
              : handle(body),
          ),
        ),
    );

  const router = yield* HttpRouter.make;
  yield* router.addAll([
    read("/info", (current) => infoXml(identity, current)),
    read("/presets", (current) => presetsXml(current.presets)),
    read("/volume", (current) => volumeXml(deviceId, current)),
    read("/nowPlaying", (current) =>
      nowPlayingXml(deviceId, current.nowPlaying),
    ),
    read("/sources", (current) => sourcesXml(deviceId, current)),
    read("/networkInfo", () => networkInfoXml(identity)),
    read("/bass", (current) => bassXml(deviceId, current)),
    write("/volume", readVolume, ({ volume, muted }) =>
      Effect.gen(function* () {
        const current = yield* Ref.updateAndGet(state, (before) => ({
          ...before,
          volume: Math.min(100, Math.max(0, volume)),
          muted: muted ?? before.muted,
        }));
        yield* notify(volumeUpdated(deviceId, current));
        return yield* accepted("/volume");
      }),
    ),
    write("/bass", readBass, (bass) =>
      Ref.update(state, (current) => ({ ...current, bass })).pipe(
        Effect.andThen(accepted("/bass")),
      ),
    ),
    write("/name", readName, (name) =>
      cloud.rename(name).pipe(Effect.andThen(accepted("/name"))),
    ),
    write("/key", readKey, ({ key, state: keyState }) =>
      // Keys act when pressed; the release that follows does nothing.
      (keyState === "press" ? pressKey(key) : Effect.void).pipe(
        Effect.andThen(accepted("/key")),
      ),
    ),
    write("/select", readContentItem, (contentItem) =>
      play(contentItem, 0).pipe(Effect.andThen(accepted("/select"))),
    ),
    write("/storePreset", readStoredPreset, ({ id, contentItem }) =>
      cloud
        .storePreset(id, contentItem)
        .pipe(Effect.andThen(accepted("/storePreset"))),
    ),
    write("/setMargeAccount", readAccountId, (accountId) =>
      Effect.map(cloud.pair(accountId), (paired) =>
        paired
          ? xml(statusXml("/setMargeAccount"))
          : xml(
              errorsXml(deviceId, {
                value: 1,
                name: "SET_MARGE_ACCOUNT_ERROR",
                message: "The Marge server refused the device",
              }),
              500,
            ),
      ),
    ),
    write(
      "/notification",
      (body) => (isSourcesUpdated(body) ? true : undefined),
      () =>
        cloud.refreshSources.pipe(Effect.andThen(accepted("/notification"))),
    ),
  ]);
  const httpServer = yield* NodeHttpServer.make(() => createServer(), {
    port: 0,
    host: HOST,
  });
  // A restarting speaker doesn't answer: requests wait until it is back.
  yield* httpServer.serve(up.whenOpen(router.asHttpEffect()));

  // -------------------------------------------------------------------------
  // Port 8080: WebSocket notifications

  const notificationsServer = yield* NodeSocketServer.makeWebSocket({
    port: 0,
    host: HOST,
  });
  yield* Effect.forkIn(
    notificationsServer.run((socket) =>
      Effect.gen(function* () {
        if (!(yield* Ref.get(state)).up) {
          return;
        }
        const down = yield* Ref.get(goingDown);
        // Writes wait for the reader: the socket opens when it is acquired.
        const { pull } = yield* socket.reader;
        const writer = yield* socket.writer;
        const subscription = yield* PubSub.subscribe(notifications);
        yield* Effect.acquireRelease(
          Ref.update(listeners, (count) => count + 1),
          () => Ref.update(listeners, (count) => count - 1),
        );
        yield* writer.write(SDK_INFO_XML);
        const forward = Effect.forever(
          Effect.flatMap(PubSub.take(subscription), writer.write),
        );
        yield* Effect.raceAll([
          forward,
          Effect.forever(pull),
          Deferred.await(down),
        ]);
      }).pipe(Effect.scoped, Effect.ignore),
    ),
    scope,
  );

  // -------------------------------------------------------------------------
  // Port 17000: the TAP console

  /** The console's reply to `command`; `None` for `sys reboot`, which hangs up. */
  const runCommand = Effect.fnUntraced(function* (command: string) {
    const words = command.split(/\s+/);
    if (command === "") {
      return Option.some("-> ");
    }
    if (words[0] === "sys" && words[1] === "configuration") {
      const field = SERVER_URL_FIELDS.find((name) => name === words[2]);
      if (field !== undefined) {
        yield* Ref.update(state, (current) => ({
          ...current,
          running: { ...current.running, [field]: words[3] ?? "" },
        }));
      }
      return Option.some("OK\r\n-> ");
    }
    if (
      words[0] === "envswitch" &&
      words[1] === "boseurls" &&
      words[2] === "set"
    ) {
      // Saves the whole running configuration, these two included.
      yield* Ref.update(state, (current) => {
        const running = {
          ...current.running,
          margeServerUrl: words[3] ?? "",
          swUpdateUrl: words[4] ?? "",
        };
        return { ...current, running, saved: running };
      });
      return Option.some(
        `Setting Bose Server URLs to ${words[3]} and ${words[4]}\r\n-> `,
      );
    }
    if (
      words[0] === "envswitch" &&
      words[1] === "accountid" &&
      words[2] === "set"
    ) {
      yield* Ref.update(state, (current) => ({
        ...current,
        pendingAccountId: words[3],
      }));
      return Option.some("-> ");
    }
    if (command === "getpdo CurrentSystemConfiguration") {
      const { running } = yield* Ref.get(state);
      return Option.some(`${configurationReply(running)}-> `);
    }
    if (command === "sys reboot") {
      yield* startRestart;
      return Option.none();
    }
    return Option.some("Command not found\r\n-> ");
  });

  const consoleServer = yield* NodeSocketServer.make({ port: 0, host: HOST });
  yield* Effect.forkIn(
    consoleServer.run((socket) =>
      Effect.gen(function* () {
        if (!(yield* Ref.get(state)).up) {
          return;
        }
        const down = yield* Ref.get(goingDown);
        const writer = yield* socket.writer;
        const pull = yield* Socket.readerString(socket);
        const session = Effect.gen(function* () {
          yield* writer.write("-> ");
          let pending = "";
          for (;;) {
            pending += (yield* pull).join("");
            let newline = pending.indexOf("\n");
            while (newline !== -1) {
              const command = pending.slice(0, newline).trim();
              pending = pending.slice(newline + 1);
              const reply = yield* runCommand(command);
              if (Option.isNone(reply)) {
                return;
              }
              yield* writer.write(reply.value);
              newline = pending.indexOf("\n");
            }
          }
        });
        yield* Effect.raceFirst(session, Deferred.await(down));
      }).pipe(Effect.scoped, Effect.ignore),
    ),
    scope,
  );

  return SpeakerEmulator.of({
    deviceId,
    host: HOST,
    ports: {
      http: portOf(httpServer.address),
      notifications: portOf(notificationsServer.address),
      console: portOf(consoleServer.address),
    },
    state: Ref.get(state),
    exchanges: Ref.get(exchanges),
    listeners: Ref.get(listeners),
    reboot: Effect.flatMap(startRestart, Deferred.await),
    booted: Effect.flatMap(Ref.get(bootDone), Deferred.await),
  });
});
