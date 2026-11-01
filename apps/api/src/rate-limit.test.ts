import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { RadioBrowser } from "./radio-browser/radio-browser.ts";
import { ACCOUNT_CREATIONS, SPEAKER_WRITES } from "./rate-limit.ts";
import { TuneIn } from "./tunein/tunein.ts";

// `RATE_LIMIT` unset: limits are on. The test clock never advances, so no
// token is refilled while a test runs.
const TestLayer = HttpAppLayer.pipe(
  Layer.provide([
    PresetsRepo.layerTest,
    DevicesRepo.layerTest,
    DeviceContactsRepo.layerTest,
    TuneIn.layer,
    RadioBrowser.layer,
  ]),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

const PRESETS_PATH = "/streaming/account/household/device/EC1127C25A50";

const savePreset = (clientIp: string) =>
  HttpClient.execute(
    HttpClientRequest.put(`${PRESETS_PATH}/preset/1`).pipe(
      HttpClientRequest.setHeader("x-real-ip", clientIp),
      HttpClientRequest.bodyText(
        "<preset><sourceid>10005</sourceid><name>FIP</name><location>/stations/byuuid/9610c454-0601-11e8-ae97-52543be04c81</location></preset>",
      ),
    ),
  ).pipe(Effect.map(({ status }) => status));

const createAccount = (clientIp: string) =>
  HttpClient.execute(
    HttpClientRequest.post("/api/internal/accounts").pipe(
      HttpClientRequest.setHeader("x-real-ip", clientIp),
    ),
  ).pipe(Effect.map(({ status }) => status));

const statusesOf = (
  count: number,
  request: Effect.Effect<number, unknown, HttpClient.HttpClient>,
) => Effect.forEach(Array.from({ length: count }), () => request);

layer(TestLayer)("rate limits", (it) => {
  it.effect(
    "refuses a client's speaker writes past its limit, not its reads nor other clients",
    () =>
      Effect.gen(function* () {
        const allowed = yield* statusesOf(
          SPEAKER_WRITES.limit,
          savePreset("203.0.113.1"),
        );
        assert.deepStrictEqual([...new Set(allowed)], [200]);
        assert.strictEqual(yield* savePreset("203.0.113.1"), 429);
        assert.strictEqual(yield* savePreset("203.0.113.2"), 200);

        const read = yield* HttpClient.execute(
          HttpClientRequest.get(`${PRESETS_PATH}/presets`).pipe(
            HttpClientRequest.setHeader("x-real-ip", "203.0.113.1"),
          ),
        );
        assert.strictEqual(read.status, 200);
      }),
  );

  it.effect("refuses a client's account creations past its limit", () =>
    Effect.gen(function* () {
      const allowed = yield* statusesOf(
        ACCOUNT_CREATIONS.limit,
        createAccount("198.51.100.1"),
      );
      assert.deepStrictEqual([...new Set(allowed)], [200]);
      assert.strictEqual(yield* createAccount("198.51.100.1"), 429);
      assert.strictEqual(yield* createAccount("198.51.100.2"), 200);
    }),
  );
});
