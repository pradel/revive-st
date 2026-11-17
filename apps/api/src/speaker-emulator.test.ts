/**
 * The server as a speaker uses it: an emulated SoundTouch speaker is set up
 * the way the app sets one up, then restarts, boots against the server and
 * plays, stores and renames through it, over real sockets.
 */
import { randomUUID } from "node:crypto";

import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import {
  EmulatedLan,
  eventually,
  type Exchange,
  openConsole,
  orDie,
  SpeakerEmulator,
  speakerHttp,
} from "@revive-st/speaker-emulator";
import {
  BoseHttpAdapter,
  type ContentItem,
  escapeXml,
} from "bose-api-speaker-client";
import { Effect, Layer, Logger } from "effect";
import { HttpClient, HttpServer } from "effect/http";

import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { GroupsRepo } from "./devices/groups-repo.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { RateLimits } from "./rate-limit.ts";
import {
  getLastContactAt,
  MISSING_UUID,
  RadioBrowserTest,
  speaker,
  STATION_UUID,
  syncPresets,
  TuneInTest,
} from "./testing.ts";
import { createNoGroupXml } from "./utils/marge-xml.ts";

// The real rate limits: a household's speakers stay within them.
const TestLayer = HttpAppLayer.pipe(
  Layer.provide(RateLimits.layer),
  Layer.provide([
    PresetsRepo.layerTest,
    DevicesRepo.layerTest,
    GroupsRepo.layerTest,
    DeviceContactsRepo.layerTest,
    TuneInTest,
    RadioBrowserTest,
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
  if (address._tag === "UnixPathAddress") {
    return yield* Effect.die(new Error("The test server listens on a port"));
  }
  return `http://127.0.0.1:${address.port}`;
});

/** A POST to the speaker the app sends with `fetch`, as the HTTP client has no method for it. */
const postToSpeaker = (path: string, body: string) =>
  Effect.gen(function* () {
    const emulated = yield* SpeakerEmulator;
    const response = yield* Effect.promise(async () =>
      fetch(`http://${emulated.host}:${emulated.ports.http}${path}`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body,
      }),
    );
    return response.status;
  });

/**
 * What the app does to set a speaker up for the server (see the configure
 * session in apps/app): makes a household account id, saves the speaker's
 * presets for it, writes the server's addresses and the account over the
 * TAP console, pairs it over HTTP, has it fetch its sources, then restarts
 * it. Resolves once the speaker has booted against the server, with its
 * last contact before the restart. A household's other speakers are set up
 * with its existing `accountId`.
 */
const setUp = (
  presets: readonly { id: number; contentItem: ContentItem }[],
  // The app makes household account ids itself.
  accountId: string = randomUUID(),
) =>
  Effect.gen(function* () {
    const emulated = yield* SpeakerEmulator;
    const server = yield* origin;
    const synced = yield* syncPresets(emulated.deviceId, presets, accountId);
    assert.strictEqual(synced.status, 200);

    const tap = yield* openConsole;
    yield* tap.run(
      `sys configuration bmxRegistryUrl ${server}/v2/registry.json`,
    );
    yield* tap.run(`sys configuration statsServerUrl ${server}`);
    yield* tap.run(`sys configuration margeServerUrl ${server}`);
    yield* tap.run(
      `sys configuration swUpdateUrl ${server}/updates/soundtouch`,
    );
    yield* tap.run(
      `envswitch boseurls set ${server} ${server}/updates/soundtouch`,
    );
    yield* tap.run(`envswitch accountid set ${accountId}`);

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
        `<updates deviceID="${emulated.deviceId}"><sourcesUpdated/></updates>`,
      ),
      200,
    );

    const contactBeforeRestart = yield* getLastContactAt(emulated.deviceId);
    yield* tap.reboot;
    return { accountId, server, contactBeforeRestart };
  });

const pathOf = ({ url }: Exchange) => new URL(url).pathname;

/** The speaker's requests since the `from`th that the server didn't answer with 2xx. */
const failedSince = (from: number) =>
  Effect.gen(function* () {
    const emulated = yield* SpeakerEmulator;
    return (yield* emulated.exchanges)
      .slice(from)
      .filter(
        ({ status }) => status === undefined || status < 200 || status >= 300,
      )
      .map(
        (exchange) =>
          `${exchange.method} ${pathOf(exchange)} ${exchange.status}`,
      );
  });

/** Runs `test` against a speaker of its own, its device id derived from `label`. */
const withSpeaker = <Value, Failure, Requirements>(
  label: string,
  test: Effect.Effect<Value, Failure, Requirements>,
) =>
  test.pipe(
    Effect.provide(SpeakerEmulator.layer({ deviceId: speaker(label) })),
  );

// Live services: the speaker restarts and resolves stations on the real clock.
layer(TestLayer, { excludeTestServices: true })("an emulated speaker", (it) => {
  it.effect(
    "set up for the server, boots against it with the household's presets, its sources ready",
    () =>
      withSpeaker(
        "emulated-boot",
        Effect.gen(function* () {
          const emulated = yield* SpeakerEmulator;
          const { accountId, server, contactBeforeRestart } = yield* setUp([
            {
              id: 1,
              contentItem: radioBrowserStation(STATION_UUID, "Chillout"),
            },
          ]);
          const api = yield* speakerHttp;

          const info = yield* orDie(async () => api.getInfo());
          assert.strictEqual(info.margeURL, server);
          assert.strictEqual(info.margeAccountUUID, accountId);

          const { presets } = yield* orDie(async () => api.getPresets());
          assert.deepStrictEqual(
            presets.map(({ id, contentItem }) => ({ id, contentItem })),
            [
              {
                id: 1,
                contentItem: radioBrowserStation(STATION_UUID, "Chillout"),
              },
            ],
          );

          const { sourceItems } = yield* orDie(async () => api.getSources());
          assert.deepStrictEqual(
            sourceItems
              .filter(({ status }) => status === "READY")
              .map(({ source }) => source),
            ["AUX", "TUNEIN", "RADIO_BROWSER", "LOCAL_INTERNET_RADIO"],
          );

          // Pairing already contacted the server: the restart must again.
          assert.isNumber(contactBeforeRestart);
          assert.isAbove(
            (yield* getLastContactAt(emulated.deviceId)) ?? 0,
            contactBeforeRestart ?? Infinity,
          );
          // The server has never served the streaming token: speakers set up
          // for it boot without one and play its stations.
          assert.deepStrictEqual(yield* failedSince(0), [
            `GET /streaming/device/${emulated.deviceId}/streaming_token 404`,
          ]);
        }),
      ),
  );

  it.effect(
    "plays a preset's station through the server's Radio Browser adapter and reports it as recent",
    () =>
      withSpeaker(
        "emulated-play",
        Effect.gen(function* () {
          const emulated = yield* SpeakerEmulator;
          yield* setUp([
            {
              id: 1,
              contentItem: radioBrowserStation(STATION_UUID, "Chillout"),
            },
            { id: 2, contentItem: radioBrowserStation(MISSING_UUID, "Gone") },
          ]);
          const api = yield* speakerHttp;
          const from = (yield* emulated.exchanges).length;

          yield* orDie(async () =>
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
          const { nowPlaying } = yield* emulated.state;
          assert.strictEqual(
            nowPlaying.kind === "playing" ? nowPlaying.streamUrl : undefined,
            "http://mp3channels.example/chillout",
          );
          const recent = yield* eventually(
            Effect.map(emulated.exchanges, (exchanges) =>
              exchanges
                .slice(from)
                .find((exchange) => pathOf(exchange).endsWith("/recent")),
            ),
          );
          assert.strictEqual(recent.status, 201);

          yield* orDie(async () =>
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
        "emulated-store",
        Effect.gen(function* () {
          const emulated = yield* SpeakerEmulator;
          const { accountId } = yield* setUp([]);
          const api = yield* speakerHttp;
          const stored = radioBrowserStation(STATION_UUID, "Rock & Roll");

          yield* orDie(async () => api.storePreset(3, stored));
          const serverPresets = yield* HttpClient.get(
            `/streaming/account/${accountId}/device/${emulated.deviceId}/presets`,
          ).pipe(Effect.flatMap((response) => response.text));
          assert.include(serverPresets, '<preset buttonNumber="3">');
          assert.include(serverPresets, "<name>Rock &amp; Roll</name>");

          yield* emulated.reboot;
          const { presets } = yield* orDie(async () => api.getPresets());
          assert.deepStrictEqual(
            presets.map(({ id, contentItem }) => ({ id, contentItem })),
            [{ id: 3, contentItem: stored }],
          );
        }),
      ),
  );

  it.effect("renames itself through the server", () =>
    withSpeaker(
      "emulated-rename",
      Effect.gen(function* () {
        const emulated = yield* SpeakerEmulator;
        yield* setUp([]);
        const api = yield* speakerHttp;
        const from = (yield* emulated.exchanges).length;

        yield* orDie(async () => api.setName("Kitchen"));
        const info = yield* orDie(async () => api.getInfo());
        assert.strictEqual(info.name, "Kitchen");
        assert.deepStrictEqual(yield* failedSince(from), []);
      }),
    ),
  );

  it.effect(
    "keeps a stereo pair made through the master across restarts, until it is undone",
    () =>
      Effect.gen(function* () {
        const left = yield* SpeakerEmulator.make({
          deviceId: speaker("emulated-pair-left"),
          ipAddress: "192.168.1.195",
        });
        const right = yield* SpeakerEmulator.make({
          deviceId: speaker("emulated-pair-right"),
          ipAddress: "192.168.1.189",
        });
        const accountId = randomUUID();
        for (const emulated of [left, right]) {
          yield* setUp([], accountId).pipe(
            Effect.provideService(SpeakerEmulator, emulated),
          );
        }
        const leftApi = new BoseHttpAdapter({
          ip: left.host,
          port: left.ports.http,
        });
        const rightApi = new BoseHttpAdapter({
          ip: right.host,
          port: right.ports.http,
        });
        const groups = Effect.all(
          [leftApi, rightApi].map((api) => orDie(async () => api.getGroup())),
        );
        /** What the server answers each speaker's boot poll. */
        const polls = Effect.all(
          [left, right].map(({ deviceId }) =>
            HttpClient.get(
              `/streaming/account/${accountId}/device/${deviceId}/group/`,
            ).pipe(Effect.flatMap((response) => response.text)),
          ),
        );
        const rebootBoth = Effect.andThen(right.reboot, left.reboot);

        const group = yield* orDie(async () =>
          leftApi.addGroup({
            name: "Living room + Office",
            masterDeviceId: left.deviceId,
            roles: [
              {
                deviceId: left.deviceId,
                role: "LEFT",
                ipAddress: "192.168.1.195",
              },
              {
                deviceId: right.deviceId,
                role: "RIGHT",
                ipAddress: "192.168.1.189",
              },
            ],
          }),
        );
        assert.match(group?.id ?? "", /^\d{7}$/);
        assert.strictEqual(group?.status, "GROUP_OK");
        assert.strictEqual(group?.masterDeviceId, left.deviceId);
        assert.deepStrictEqual(yield* groups, [group, group]);

        // Both ask the server at boot; it answers with the pair it stored.
        yield* rebootBoth;
        assert.deepStrictEqual(yield* groups, [group, group]);

        const removed = yield* orDie(async () => leftApi.removeGroup());
        assert.deepStrictEqual(removed, { peerUnreachable: false });
        assert.deepStrictEqual(yield* groups, [null, null]);
        assert.deepStrictEqual(yield* polls, [
          createNoGroupXml(),
          createNoGroupXml(),
        ]);

        yield* rebootBoth;
        assert.deepStrictEqual(yield* groups, [null, null]);
        for (const emulated of [left, right]) {
          const failed = (yield* emulated.exchanges).filter(
            ({ url, status }) =>
              url.includes("/group") &&
              (status === undefined || status < 200 || status >= 300),
          );
          assert.deepStrictEqual(failed, []);
        }
      }).pipe(Effect.provide(EmulatedLan.layer)),
  );
});
