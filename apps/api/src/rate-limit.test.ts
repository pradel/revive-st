import { randomUUID } from "node:crypto";

import { NodeHttpServer } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger, References } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "effect/http";
import { TestClock } from "effect/testing";

import { RADIO_BROWSER_BASE_PATH, TUNEIN_BASE_PATH } from "./api/bmx.ts";
import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { GroupsRepo } from "./devices/groups-repo.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { RateLimits } from "./rate-limit.ts";
import {
  RadioBrowserTest,
  speaker,
  STATION_UUID,
  syncPresets,
  TuneInTest,
} from "./testing.ts";

/** Every log line the server writes, Debug included, as JSON. */
const logLines: string[] = [];

// Built for each test, so each starts with full buckets.
const TestLayer = HttpAppLayer.pipe(
  Layer.provide(
    RateLimits.layer.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({ CLIENT_IP_HEADER: "X-Client-IP" }),
        ),
      ),
    ),
  ),
  Layer.provide([
    PresetsRepo.layerTest,
    DevicesRepo.layerTest,
    GroupsRepo.layerTest,
    DeviceContactsRepo.layerTest,
    TuneInTest,
    RadioBrowserTest,
    Logger.layer([
      Logger.map(Logger.formatJson, (line) => {
        logLines.push(line);
      }),
    ]),
    Layer.succeed(References.MinimumLogLevel, "All"),
  ]),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

/** A GET, from `client` when given, else from the connection's address. */
const get = (path: string, client?: string) =>
  HttpClient.execute(
    HttpClientRequest.get(path).pipe(
      HttpClientRequest.setHeaders(
        client === undefined ? {} : { "x-client-ip": client },
      ),
    ),
  );

/** The statuses of `count` requests made with `request`. */
const statuses = (
  count: number,
  request: () => Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    unknown,
    HttpClient.HttpClient
  >,
) =>
  Effect.forEach(
    Array.from({ length: count }),
    () => Effect.map(request(), (response) => response.status),
    { concurrency: 10 },
  );

/** Asserts `response` is the bare `429` the limits answer with. */
const assertTooManyRequests = (
  response: HttpClientResponse.HttpClientResponse,
  retryAfter: string,
) =>
  Effect.gen(function* () {
    assert.strictEqual(response.status, 429);
    assert.strictEqual(response.headers["retry-after"], retryAfter);
    assert.strictEqual(yield* response.text, "");
  });

const TUNEIN_STATION = `${TUNEIN_BASE_PATH}/v1/playback/station/s1`;
const RADIO_BROWSER_STATION = `${RADIO_BROWSER_BASE_PATH}/stations/byuuid/${STATION_UUID}`;

describe("rate limits", () => {
  it.effect(
    "allow each client 600 requests a minute, the status page aside",
    () =>
      Effect.gen(function* () {
        const sourceProviders = "/streaming/sourceproviders";
        assert.deepStrictEqual(
          yield* statuses(600, () => get(sourceProviders, "203.0.113.1")),
          Array.from({ length: 600 }, () => 200),
        );
        yield* assertTooManyRequests(
          yield* get(sourceProviders, "203.0.113.1"),
          "1",
        );
        assert.strictEqual((yield* get("/", "203.0.113.1")).status, 200);
        assert.strictEqual(
          (yield* get(sourceProviders, "203.0.113.2")).status,
          200,
        );
        // Without the header, the client is the connection's peer.
        assert.strictEqual((yield* get(sourceProviders)).status, 200);

        yield* TestClock.adjust("100 millis");
        assert.strictEqual(
          (yield* get(sourceProviders, "203.0.113.1")).status,
          200,
        );
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("allow each client 60 station lookups a minute", () =>
    Effect.gen(function* () {
      // Spelled differently, the path still reaches the TuneIn station route.
      assert.deepStrictEqual(
        yield* statuses(60, () =>
          get("/BMX//tune%69n/v1/playback/station/s1/"),
        ),
        Array.from({ length: 60 }, () => 200),
      );
      yield* assertTooManyRequests(yield* get(TUNEIN_STATION), "1");
      yield* assertTooManyRequests(yield* get(RADIO_BROWSER_STATION), "1");
      assert.strictEqual(
        (yield* get("/streaming/sourceproviders")).status,
        200,
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "allow each client 60 writes a minute, and don't log refusals",
    () =>
      Effect.gen(function* () {
        const device = speaker("writes");
        const accountId = randomUUID();
        assert.deepStrictEqual(
          yield* statuses(60, () => syncPresets(device, [], accountId)),
          Array.from({ length: 60 }, () => 200),
        );
        const firstLine = logLines.length;
        yield* assertTooManyRequests(
          yield* syncPresets(device, [], accountId),
          "1",
        );
        assert.deepStrictEqual(logLines.slice(firstLine), []);
        assert.strictEqual(
          (yield* get(`/streaming/account/${accountId}/full`)).status,
          200,
        );
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "allow each client 20 requests an hour naming unpaired accounts, then refuse it every account",
    () =>
      Effect.gen(function* () {
        // Pairing the household's account spends one.
        const household = randomUUID();
        assert.strictEqual(
          (yield* syncPresets(speaker("household"), [], household)).status,
          200,
        );
        // Spelled differently, the path still names an account.
        assert.deepStrictEqual(
          yield* statuses(19, () =>
            get(`/STREAMING//%61ccount/${randomUUID()}/full`),
          ),
          Array.from({ length: 19 }, () => 200),
        );
        yield* assertTooManyRequests(
          yield* get(`/streaming/account/${randomUUID()}/full`),
          "180",
        );
        // Answering would tell a paired account from an unpaired one.
        yield* assertTooManyRequests(
          yield* get(`/streaming/account/${household}/full`),
          "180",
        );
        assert.strictEqual(
          (yield* get(`/streaming/account/${household}/full`, "203.0.113.1"))
            .status,
          200,
        );

        yield* TestClock.adjust("3 minutes");
        assert.strictEqual(
          (yield* get(`/streaming/account/${randomUUID()}/full`)).status,
          200,
        );
        yield* assertTooManyRequests(
          yield* get(`/streaming/account/${household}/full`),
          "180",
        );
      }).pipe(Effect.provide(TestLayer)),
  );
});
