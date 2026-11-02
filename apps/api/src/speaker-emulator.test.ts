/**
 * The server as a speaker uses it: an emulated SoundTouch speaker is set up
 * the way the app sets one up, then restarts, boots against the server and
 * plays, stores and renames through it, over real sockets.
 */
import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import {
  eventually,
  type Exchange,
  openConsole,
  orDie,
  SpeakerEmulator,
  speakerHttp,
} from "@revive-st/speaker-emulator";
import { type ContentItem, escapeXml } from "bose-api-speaker-client";
import { Effect, Layer, Logger } from "effect";
import { HttpClient, HttpServer } from "effect/http";

import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import {
  getLastContactAt,
  MISSING_UUID,
  mintAccountId,
  RadioBrowserTest,
  speaker,
  STATION_UUID,
  syncPresets,
  TuneInTest,
} from "./testing.ts";

const TestLayer = HttpAppLayer.pipe(
  Layer.provide([
    PresetsRepo.layerTest,
    DevicesRepo.layerTest,
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
 * session in apps/app): saves its presets for the household, writes the
 * server's addresses and the account over the TAP console, pairs it over
 * HTTP, has it fetch its sources, then restarts it. Resolves once the
 * speaker has booted against the server, with its last contact before the
 * restart.
 */
const setUp = (presets: readonly { id: number; contentItem: ContentItem }[]) =>
  Effect.gen(function* () {
    const emulated = yield* SpeakerEmulator;
    const server = yield* origin;
    const accountId = yield* mintAccountId;
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
          // The server doesn't serve the speaker's streaming token, which
          // the speaker boots without.
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
});
