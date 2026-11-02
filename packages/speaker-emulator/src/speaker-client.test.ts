/**
 * bose-api-speaker-client against the emulator over real sockets: the
 * speaker's API, its WebSocket notifications and its TAP console.
 */
import {
  BoseWebSocketClient,
  type BoseWSUpdate,
  type ContentItem,
} from "bose-api-speaker-client";
import { Effect, type Scope } from "effect";
import { assert, describe, it } from "vite-plus/test";

import type { SpeakerConfig } from "./config.ts";
import { SpeakerEmulator } from "./emulator.ts";
import { eventually, openConsole, orDie, speakerHttp } from "./testing.ts";

const DEVICE_ID = "A81B6A631A1E";

const RADIO: ContentItem = {
  source: "RADIO_BROWSER",
  type: "stationurl",
  location: "/stations/byuuid/9610c454-0601-11e8-ae97-52543be04c81",
  sourceAccount: "",
  isPresetable: true,
  itemName: "Rock & Roll Radio",
  containerArt: "https://cdn.example/logo.png",
};

/** A speaker that was paired with an account and points at a server that isn't there. */
const PAIRED: SpeakerConfig = {
  deviceId: DEVICE_ID,
  name: "Living Room",
  margeAccountUUID: "household-1",
  urls: {
    bmxRegistryUrl: "http://127.0.0.1:9/v2/registry.json",
    statsServerUrl: "http://127.0.0.1:9",
    margeServerUrl: "http://127.0.0.1:9",
    swUpdateUrl: "http://127.0.0.1:9/updates/soundtouch",
  },
  presets: [{ id: 1, contentItem: RADIO }],
  accountSources: [{ id: "10005", source: "RADIO_BROWSER", sourceAccount: "" }],
};

/** Runs `test` against a speaker of its own. */
const withSpeaker = async <Value, Failure>(
  test: Effect.Effect<Value, Failure, SpeakerEmulator | Scope.Scope>,
  config: SpeakerConfig = PAIRED,
) =>
  Effect.runPromise(
    test.pipe(Effect.scoped, Effect.provide(SpeakerEmulator.layer(config))),
  );

describe("BoseHttpAdapter", () => {
  it("reads the speaker's info, presets, sources and now playing", async () =>
    withSpeaker(
      Effect.gen(function* () {
        const client = yield* speakerHttp;
        const info = yield* orDie(async () => client.getInfo());
        assert.strictEqual(info.deviceID, DEVICE_ID);
        assert.strictEqual(info.name, "Living Room");
        assert.strictEqual(info.margeURL, "http://127.0.0.1:9");
        assert.strictEqual(info.margeAccountUUID, "household-1");
        assert.strictEqual(info.networkInfo.macAddress, DEVICE_ID);

        const { presets } = yield* orDie(async () => client.getPresets());
        assert.deepStrictEqual(
          presets.map(({ id, contentItem }) => ({ id, contentItem })),
          [{ id: 1, contentItem: RADIO }],
        );

        const sources = yield* orDie(async () => client.getSources());
        assert.deepStrictEqual(
          sources.sourceItems.map(({ source, status }) => ({ source, status })),
          [
            { source: "AUX", status: "READY" },
            { source: "BLUETOOTH", status: "UNAVAILABLE" },
            { source: "RADIO_BROWSER", status: "READY" },
          ],
        );

        const nowPlaying = yield* orDie(async () => client.getNowPlaying());
        assert.strictEqual(nowPlaying.source, "STANDBY");
      }),
    ));

  it("stores a preset and sets the volume", async () =>
    withSpeaker(
      Effect.gen(function* () {
        const client = yield* speakerHttp;
        const stored = { ...RADIO, itemName: `Jazz <"FM"> & 'Co'` };
        yield* orDie(async () => client.storePreset(4, stored));
        const { presets } = yield* orDie(async () => client.getPresets());
        assert.deepStrictEqual(
          presets.find(({ id }) => id === 4)?.contentItem,
          stored,
        );

        yield* orDie(async () => client.setVolume({ volume: 37 }));
        const volume = yield* orDie(async () => client.getVolume());
        assert.strictEqual(volume.actualvolume, 37);
        assert.strictEqual(volume.muteenabled, false);
      }),
    ));
});

describe("BoseWebSocketClient", () => {
  it("reports volume, name and now playing changes until it disconnects", async () =>
    withSpeaker(
      Effect.gen(function* () {
        const speaker = yield* SpeakerEmulator;
        const client = yield* speakerHttp;
        const updates: BoseWSUpdate[] = [];
        const notifications = new BoseWebSocketClient({
          host: speaker.host,
          port: speaker.ports.notifications,
          deviceID: DEVICE_ID,
          onUpdate: (update) => {
            updates.push(update);
          },
        });
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            notifications.connect();
          }),
          () =>
            Effect.sync(() => {
              notifications.close();
            }),
        );
        yield* eventually(
          Effect.map(speaker.listeners, (count) =>
            count > 0 ? count : undefined,
          ),
        );
        const received = <Type extends BoseWSUpdate["type"]>(type: Type) =>
          eventually(
            Effect.sync(() =>
              updates.find(
                (update): update is Extract<BoseWSUpdate, { type: Type }> =>
                  update.type === type,
              ),
            ),
          );

        yield* orDie(async () => client.setVolume({ volume: 12 }));
        const volume = yield* received("volume");
        assert.strictEqual(volume.volume?.actualVolume, 12);

        yield* orDie(async () => client.setName("Kitchen & Bath"));
        const name = yield* received("nameUpdated");
        assert.strictEqual(name.name, "Kitchen & Bath");

        yield* orDie(async () =>
          client.pressKey({ key: "POWER", state: "press", sender: "Gabbo" }),
        );
        const nowPlaying = yield* received("nowPlaying");
        assert.strictEqual(nowPlaying.nowPlaying?.source, "AUX");
        assert.strictEqual(nowPlaying.nowPlaying?.playStatus, "PLAY_STATE");

        notifications.close();
        yield* eventually(
          Effect.map(speaker.listeners, (count) =>
            count === 0 ? count : undefined,
          ),
        );
      }),
      // Unpaired: it renames itself without asking a Marge server.
      { deviceId: DEVICE_ID },
    ));
});

describe("TelnetClient", () => {
  it("writes and reads back the configuration, then reboots", async () =>
    withSpeaker(
      Effect.gen(function* () {
        const speaker = yield* SpeakerEmulator;
        const tap = yield* openConsole;

        assert.include(
          yield* tap.run(
            "sys configuration margeServerUrl http://127.0.0.1:10",
          ),
          "OK",
        );
        assert.include(
          yield* tap.run("getpdo CurrentSystemConfiguration"),
          'margeServerUrl {\r\n  text: "http://127.0.0.1:10"\r\n}',
        );
        assert.include(yield* tap.run("sys frobnicate"), "Command not found");

        yield* tap.reboot;
        // `sys configuration` alone doesn't survive the restart.
        assert.strictEqual(
          (yield* speaker.state).running.margeServerUrl,
          "http://127.0.0.1:9",
        );
      }),
    ));
});

describe("SpeakerEmulator", () => {
  it("joins a restart already under way", async () =>
    withSpeaker(
      Effect.gen(function* () {
        const speaker = yield* SpeakerEmulator;
        yield* Effect.all([speaker.reboot, speaker.reboot], {
          concurrency: "unbounded",
        });
        const powerOns = (yield* speaker.exchanges).filter(({ url }) =>
          url.endsWith("/streaming/support/power_on"),
        );
        assert.strictEqual(powerOns.length, 1);
      }),
    ));
});
