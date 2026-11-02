/**
 * The server as a speaker uses it: an emulated SoundTouch speaker is set up
 * the way the app sets one up, then restarts, boots against the server and
 * plays, stores and renames through it, over real sockets.
 */
import net from "node:net";

import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { type Exchange, SpeakerEmulator } from "@revive-st/speaker-emulator";
import type { Result } from "better-result";
import {
  BoseHttpAdapter,
  type ContentItem,
  escapeXml,
  TelnetClient,
} from "bose-api-speaker-client";
import { Effect, Layer, Logger, Schedule, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpIncomingMessage,
  HttpServer,
} from "effect/http";

import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import {
  RadioBrowser,
  RadioBrowserStationNotFound,
} from "./radio-browser/radio-browser.ts";
import { TuneIn, TuneInUnavailable } from "./tunein/tunein.ts";

const STATION_UUID = "9610c454-0601-11e8-ae97-52543be04c81";
const MISSING_UUID = "00000000-0000-0000-0000-000000000404";

const TestLayer = HttpAppLayer.pipe(
  Layer.provide([
    PresetsRepo.layerTest,
    DevicesRepo.layerTest,
    DeviceContactsRepo.layerTest,
    Layer.succeed(
      TuneIn,
      TuneIn.of({
        station: () => Effect.fail(new TuneInUnavailable({ reason: "down" })),
      }),
    ),
    Layer.succeed(
      RadioBrowser,
      RadioBrowser.of({
        station: (stationUuid) =>
          stationUuid === MISSING_UUID
            ? Effect.fail(new RadioBrowserStationNotFound({ stationUuid }))
            : Effect.succeed({
                streamUrls: ["http://mp3channels.example/chillout"],
                name: "Antenne Bayern - Chillout",
                imageUrl: "https://cdn.example/antenne.png",
              }),
      }),
    ),
    // The server's request logs aren't under test.
    Logger.layer([]),
  ]),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

const radioBrowserStation = (
  stationUuid: string,
  itemName: string,
): ContentItem => ({
  source: "RADIO_BROWSER",
  type: "stationurl",
  location: `/stations/byuuid/${stationUuid}`,
  sourceAccount: "",
  isPresetable: true,
  itemName,
  containerArt: "",
});

/** The server's address as the speaker, on the same host, reaches it. */
const origin = Effect.gen(function* () {
  const { address } = yield* HttpServer.HttpServer;
  return address._tag === "UnixPathAddress"
    ? ""
    : `http://127.0.0.1:${address.port}`;
});

/** Runs a speaker client call, failing the test when it reports an error. */
const ok = <Value, Failure>(request: () => Promise<Result<Value, Failure>>) =>
  Effect.flatMap(Effect.promise(request), (result) =>
    result.isOk() ? Effect.succeed(result.value) : Effect.die(result.error),
  );

/** Retries `check` until it holds, for what the speaker does in the background. */
const eventually = <Value>(check: Effect.Effect<Value | undefined>) =>
  check.pipe(
    Effect.flatMap((value) =>
      value === undefined
        ? Effect.fail("not yet" as const)
        : Effect.succeed(value),
    ),
    Effect.retry(Schedule.spaced("20 millis")),
    Effect.timeout("3 seconds"),
    Effect.orDie,
  );

const speakerApi = Effect.gen(function* () {
  const speaker = yield* SpeakerEmulator;
  return new BoseHttpAdapter({ ip: speaker.host, port: speaker.ports.http });
});

/** A POST to the speaker the app sends with `fetch`, as the HTTP client has no method for it. */
const postToSpeaker = (path: string, body: string) =>
  Effect.gen(function* () {
    const speaker = yield* SpeakerEmulator;
    const response = yield* Effect.promise(async () =>
      fetch(`http://${speaker.host}:${speaker.ports.http}${path}`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body,
      }),
    );
    return response.status;
  });

const mintAccountId = HttpClient.post("/api/internal/accounts").pipe(
  Effect.flatMap(
    HttpIncomingMessage.schemaBodyJson(
      Schema.Struct({ accountId: Schema.String }),
    ),
  ),
  Effect.map(({ accountId }) => accountId),
);

const lastContactAt = (deviceId: string) =>
  HttpClient.get(`/api/internal/device/${deviceId}/contact`).pipe(
    Effect.flatMap(
      HttpIncomingMessage.schemaBodyJson(
        Schema.Struct({ lastContactAt: Schema.NullOr(Schema.Number) }),
      ),
    ),
    Effect.map((reply) => reply.lastContactAt),
  );

/**
 * What the app does to set a speaker up for the server (see the configure
 * session in apps/app): saves its presets for the household, writes the
 * server's addresses and the account over the TAP console, pairs it over
 * HTTP, has it fetch its sources, then restarts it. Resolves once the
 * speaker has booted against the server.
 */
const setUp = (presets: readonly { id: number; contentItem: ContentItem }[]) =>
  Effect.gen(function* () {
    const speaker = yield* SpeakerEmulator;
    const server = yield* origin;
    const accountId = yield* mintAccountId;
    const synced = yield* HttpClient.execute(
      HttpClientRequest.post(
        `/api/internal/account/${accountId}/device/${speaker.deviceId}/presets`,
      ).pipe(HttpClientRequest.bodyJsonUnsafe({ presets })),
    );
    assert.strictEqual(synced.status, 200);

    const tap = new TelnetClient({
      host: speaker.host,
      port: speaker.ports.console,
      socket: net,
    });
    yield* ok(async () => tap.connect());
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        tap.disconnect();
      }),
    );
    const run = (command: string) =>
      ok(async () => tap.executeCommand(command, { quietMs: 50 }));
    yield* run(`sys configuration bmxRegistryUrl ${server}/v2/registry.json`);
    yield* run(`sys configuration statsServerUrl ${server}`);
    yield* run(`sys configuration margeServerUrl ${server}`);
    yield* run(`sys configuration swUpdateUrl ${server}/updates/soundtouch`);
    yield* run(`envswitch boseurls set ${server} ${server}/updates/soundtouch`);
    yield* run(`envswitch accountid set ${accountId}`);

    assert.strictEqual(
      yield* postToSpeaker(
        "/setMargeAccount",
        `<PairDeviceWithAccount><accountId>${escapeXml(accountId)}</accountId><userAuthToken>dontcare</userAuthToken></PairDeviceWithAccount>`,
      ),
      200,
    );
    assert.strictEqual(
      yield* postToSpeaker(
        "/notification",
        `<updates deviceID="${speaker.deviceId}"><sourcesUpdated/></updates>`,
      ),
      200,
    );

    const reboot = yield* Effect.promise(async () =>
      tap.executeCommand("sys reboot", { quietMs: 50 }),
    );
    assert.isTrue(reboot.isErr() && reboot.error.reason === "closed");
    yield* speaker.booted;
    return { accountId, server };
  });

const pathOf = ({ url }: Exchange) => new URL(url).pathname;

/** The speaker's requests since the `from`th that the server didn't answer with 2xx. */
const failedSince = (from: number) =>
  Effect.gen(function* () {
    const speaker = yield* SpeakerEmulator;
    return (yield* speaker.exchanges)
      .slice(from)
      .filter(
        ({ status }) => status === undefined || status < 200 || status >= 300,
      )
      .map(
        (exchange) =>
          `${exchange.method} ${pathOf(exchange)} ${exchange.status}`,
      );
  });

let speakers = 0;

/** A speaker of its own for each test, its device id a fresh MAC address. */
const withSpeaker = <Value, Failure, Requirements>(
  test: Effect.Effect<Value, Failure, Requirements>,
) =>
  test.pipe(
    Effect.provide(
      SpeakerEmulator.layer({
        deviceId: `A81B6A63${(++speakers).toString(16).padStart(4, "0").toUpperCase()}`,
      }),
    ),
  );

// Live services: the speaker restarts and resolves stations on the real clock.
layer(TestLayer, { excludeTestServices: true })("an emulated speaker", (it) => {
  it.effect(
    "set up for the server, boots against it with the household's presets, its sources ready",
    () =>
      withSpeaker(
        Effect.gen(function* () {
          const speaker = yield* SpeakerEmulator;
          const { accountId, server } = yield* setUp([
            {
              id: 1,
              contentItem: radioBrowserStation(STATION_UUID, "Chillout"),
            },
          ]);
          const api = yield* speakerApi;

          const info = yield* ok(async () => api.getInfo());
          assert.strictEqual(info.margeURL, server);
          assert.strictEqual(info.margeAccountUUID, accountId);

          const { presets } = yield* ok(async () => api.getPresets());
          assert.deepStrictEqual(
            presets.map(({ id, contentItem }) => ({ id, contentItem })),
            [
              {
                id: 1,
                contentItem: radioBrowserStation(STATION_UUID, "Chillout"),
              },
            ],
          );

          const { sourceItems } = yield* ok(async () => api.getSources());
          assert.deepStrictEqual(
            sourceItems
              .filter(({ status }) => status === "READY")
              .map(({ source }) => source),
            ["AUX", "TUNEIN", "RADIO_BROWSER", "LOCAL_INTERNET_RADIO"],
          );

          assert.isNumber(yield* lastContactAt(speaker.deviceId));
          // The server doesn't serve the speaker's streaming token, which
          // the speaker boots without.
          assert.deepStrictEqual(yield* failedSince(0), [
            `GET /streaming/device/${speaker.deviceId}/streaming_token 404`,
          ]);
        }),
      ),
  );

  it.effect(
    "plays a preset's station through the server's Radio Browser adapter and reports it as recent",
    () =>
      withSpeaker(
        Effect.gen(function* () {
          const speaker = yield* SpeakerEmulator;
          yield* setUp([
            {
              id: 1,
              contentItem: radioBrowserStation(STATION_UUID, "Chillout"),
            },
            { id: 2, contentItem: radioBrowserStation(MISSING_UUID, "Gone") },
          ]);
          const api = yield* speakerApi;
          const from = (yield* speaker.exchanges).length;

          yield* ok(async () =>
            api.pressKey({ key: "PRESET_1", state: "press", sender: "Gabbo" }),
          );
          const playing = yield* eventually(
            Effect.map(
              Effect.promise(async () => api.getNowPlaying()),
              (result) =>
                result.isOk() && result.value.playStatus === "PLAY_STATE"
                  ? result.value
                  : undefined,
            ),
          );
          assert.strictEqual(playing.source, "RADIO_BROWSER");
          assert.strictEqual(playing.stationName, "Antenne Bayern - Chillout");
          const { nowPlaying } = yield* speaker.state;
          assert.strictEqual(
            nowPlaying.kind === "playing" ? nowPlaying.streamUrl : undefined,
            "http://mp3channels.example/chillout",
          );
          const recent = yield* eventually(
            Effect.map(speaker.exchanges, (exchanges) =>
              exchanges
                .slice(from)
                .find((exchange) => pathOf(exchange).endsWith("/recent")),
            ),
          );
          assert.strictEqual(recent.status, 201);

          yield* ok(async () =>
            api.pressKey({ key: "PRESET_2", state: "press", sender: "Gabbo" }),
          );
          const failed = yield* eventually(
            Effect.map(
              Effect.promise(async () => api.getNowPlaying()),
              (result) =>
                result.isOk() && result.value.source === "INVALID_SOURCE"
                  ? result.value
                  : undefined,
            ),
          );
          assert.strictEqual(failed.contentItem.location, "");
        }),
      ),
  );

  it.effect(
    "saves a preset stored on the speaker, which it keeps across a restart",
    () =>
      withSpeaker(
        Effect.gen(function* () {
          const speaker = yield* SpeakerEmulator;
          const { accountId } = yield* setUp([]);
          const api = yield* speakerApi;
          const stored = radioBrowserStation(STATION_UUID, "Rock & Roll");

          yield* ok(async () => api.storePreset(3, stored));
          const serverPresets = yield* HttpClient.get(
            `/streaming/account/${accountId}/device/${speaker.deviceId}/presets`,
          ).pipe(Effect.flatMap((response) => response.text));
          assert.include(serverPresets, '<preset buttonNumber="3">');
          assert.include(serverPresets, "<name>Rock &amp; Roll</name>");

          yield* speaker.reboot;
          const { presets } = yield* ok(async () => api.getPresets());
          assert.deepStrictEqual(
            presets.map(({ id, contentItem }) => ({ id, contentItem })),
            [{ id: 3, contentItem: stored }],
          );
        }),
      ),
  );

  it.effect("renames itself through the server", () =>
    withSpeaker(
      Effect.gen(function* () {
        const speaker = yield* SpeakerEmulator;
        yield* setUp([]);
        const api = yield* speakerApi;
        const from = (yield* speaker.exchanges).length;

        yield* ok(async () => api.setName("Kitchen"));
        const info = yield* ok(async () => api.getInfo());
        assert.strictEqual(info.name, "Kitchen");
        assert.deepStrictEqual(yield* failedSince(from), []);
      }),
    ),
  );
});
