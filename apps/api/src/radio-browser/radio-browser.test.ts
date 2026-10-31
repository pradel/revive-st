import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { RadioBrowser } from "./radio-browser.ts";

const UUID = "9610c454-0601-11e8-ae97-52543be04c81";

const station = (fields: Record<string, unknown> = {}) => ({
  changeuuid: "2a5f5baf-ca59-4042-bd7e-7bb1c09a5687",
  stationuuid: UUID,
  name: "Antenne Bayern - Chillout",
  url: "http://mp3channels.webradio.antenne.de/chillout.m3u",
  url_resolved: "http://mp3channels.webradio.antenne.de/chillout",
  favicon: "https://cdn.example/antenne.png",
  hls: 0,
  ...fields,
});

/**
 * Radio Browser answering each request with the next reply: a status and
 * JSON body.
 */
const radioBrowserWith = (
  replies: { status: number; body: unknown }[],
  seen: { url: URL; userAgent: string | undefined }[] = [],
) =>
  RadioBrowser.layerNoDeps.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request, url) => {
          const reply = replies.shift() ?? { status: 500, body: null };
          seen.push({ url, userAgent: request.headers["user-agent"] });
          return Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify(reply.body), {
                status: reply.status,
              }),
            ),
          );
        }),
      ),
    ),
  );

describe("RadioBrowser", () => {
  it.effect("resolves a station to its current stream and logo", () => {
    const seen: { url: URL; userAgent: string | undefined }[] = [];
    return Effect.gen(function* () {
      assert.deepStrictEqual(yield* (yield* RadioBrowser).station(UUID), {
        streamUrls: ["http://mp3channels.webradio.antenne.de/chillout"],
        name: "Antenne Bayern - Chillout",
        imageUrl: "https://cdn.example/antenne.png",
      });
      assert.strictEqual(seen[0].url.pathname, `/json/stations/byuuid/${UUID}`);
      assert.match(seen[0].userAgent ?? "", /^ReviveST\//);
    }).pipe(
      Effect.provide(
        radioBrowserWith([{ status: 200, body: [station()] }], seen),
      ),
    );
  });

  it.effect("plays the listed URL when Radio Browser has not resolved it", () =>
    Effect.gen(function* () {
      const { streamUrls } = yield* (yield* RadioBrowser).station(UUID);
      assert.deepStrictEqual(streamUrls, [
        "http://mp3channels.webradio.antenne.de/chillout.m3u",
      ]);
    }).pipe(
      Effect.provide(
        radioBrowserWith([
          { status: 200, body: [station({ url_resolved: "" })] },
        ]),
      ),
    ),
  );

  it.effect.each([
    ["an unknown station", []],
    ["an HLS station, which speakers cannot play", [station({ hls: 1 })]],
    ["a station without a stream", [station({ url: "", url_resolved: "" })]],
  ])("reports %s as not found", ([, body]) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip((yield* RadioBrowser).station(UUID));
      assert.strictEqual(error._tag, "RadioBrowserStationNotFound");
    }).pipe(Effect.provide(radioBrowserWith([{ status: 200, body }]))),
  );

  it.effect("tries once more when Radio Browser fails", () =>
    Effect.gen(function* () {
      const { name } = yield* (yield* RadioBrowser).station(UUID);
      assert.strictEqual(name, "Antenne Bayern - Chillout");
    }).pipe(
      Effect.provide(
        radioBrowserWith([
          { status: 503, body: null },
          { status: 200, body: [station()] },
        ]),
      ),
    ),
  );

  it.effect("reports Radio Browser failing twice", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip((yield* RadioBrowser).station(UUID));
      assert.strictEqual(error._tag, "RadioBrowserUnavailable");
    }).pipe(
      Effect.provide(
        radioBrowserWith([
          { status: 503, body: null },
          { status: 503, body: null },
          { status: 200, body: [station()] },
        ]),
      ),
    ),
  );

  it.effect("asks Radio Browser once per station for five minutes", () => {
    const seen: { url: URL; userAgent: string | undefined }[] = [];
    return Effect.gen(function* () {
      const radioBrowser = yield* RadioBrowser;
      yield* radioBrowser.station(UUID);
      yield* TestClock.adjust("4 minutes");
      yield* radioBrowser.station(UUID);
      assert.strictEqual(seen.length, 1);

      yield* TestClock.adjust("1 minute");
      yield* radioBrowser.station(UUID);
      assert.strictEqual(seen.length, 2);
    }).pipe(
      Effect.provide(
        radioBrowserWith(
          [
            { status: 200, body: [station()] },
            { status: 200, body: [station()] },
          ],
          seen,
        ),
      ),
    );
  });

  it.effect("asks Radio Browser again right after it failed", () =>
    Effect.gen(function* () {
      const radioBrowser = yield* RadioBrowser;
      yield* Effect.flip(radioBrowser.station(UUID));
      const { name } = yield* radioBrowser.station(UUID);
      assert.strictEqual(name, "Antenne Bayern - Chillout");
    }).pipe(
      Effect.provide(
        radioBrowserWith([
          { status: 503, body: null },
          { status: 503, body: null },
          { status: 200, body: [station()] },
        ]),
      ),
    ),
  );
});
