import { assert, describe, it } from "@effect/vitest";
import { Effect, Fiber, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { parseDescribeResponse, parseTuneResponse, TuneIn } from "./tunein.ts";

/** A trimmed live `describe.ashx` answer. */
const DESCRIBE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1">
	<head>
	<status>200</status>
	</head>
	<body>
<outline type="object" text="SMOOTH JAZZ">
<station>
  <guide_id>s166521</guide_id>
  <name>SMOOTH JAZZ</name>
  <frequency />
  <logo>https://cdn-profiles.tunein.com/s166521/images/logoq.png?t=638398103700000000</logo>
</station>
</outline>
	</body>
</opml>`;

/**
 * TuneIn serving `routes` by path: `null` never answers, a missing path is a
 * 404.
 */
const tuneInWith = (routes: Record<string, string | null>, seen: URL[] = []) =>
  TuneIn.layerNoDeps.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request, url) => {
          seen.push(url);
          const body = routes[url.pathname];
          return body === null
            ? Effect.never
            : Effect.succeed(
                HttpClientResponse.fromWeb(
                  request,
                  new Response(body ?? "", {
                    status: body === undefined ? 404 : 200,
                  }),
                ),
              );
        }),
      ),
    ),
  );

describe("parseTuneResponse", () => {
  it("keeps one stream URL per line, skipping comments and blanks", () => {
    assert.deepStrictEqual(
      parseTuneResponse(
        "#EXTM3U\nhttp://a.example/1.mp3\r\n\n  https://b.example/2.aac  \n",
      ),
      ["http://a.example/1.mp3", "https://b.example/2.aac"],
    );
  });

  it("finds no stream in TuneIn's unknown-station answer", () => {
    assert.deepStrictEqual(parseTuneResponse("#STATUS: 400\n"), []);
  });
});

describe("parseDescribeResponse", () => {
  it("reads the station name and logo", () => {
    assert.deepStrictEqual(parseDescribeResponse(DESCRIBE_XML), {
      name: "SMOOTH JAZZ",
      imageUrl:
        "https://cdn-profiles.tunein.com/s166521/images/logoq.png?t=638398103700000000",
    });
  });
});

describe("TuneIn", () => {
  it.effect("resolves a station without asking for HLS streams", () => {
    const seen: URL[] = [];
    return Effect.gen(function* () {
      const station = yield* (yield* TuneIn).station("s166521");
      assert.deepStrictEqual(station, {
        streamUrls: ["http://a.example/1.mp3"],
        name: "SMOOTH JAZZ",
        imageUrl:
          "https://cdn-profiles.tunein.com/s166521/images/logoq.png?t=638398103700000000",
      });
      const tune = seen.find((url) => url.pathname === "/Tune.ashx");
      assert.strictEqual(tune?.searchParams.get("id"), "s166521");
      assert.strictEqual(tune?.searchParams.get("formats"), "mp3,aac,ogg");
    }).pipe(
      Effect.provide(
        tuneInWith(
          {
            "/Tune.ashx": "http://a.example/1.mp3\n",
            "/describe.ashx": DESCRIBE_XML,
          },
          seen,
        ),
      ),
    );
  });

  it.effect("plays a station whose description is unavailable", () =>
    Effect.gen(function* () {
      const station = yield* (yield* TuneIn).station("s1");
      assert.deepStrictEqual(station, {
        streamUrls: ["http://a.example/1.mp3"],
        name: "",
        imageUrl: "",
      });
    }).pipe(
      Effect.provide(tuneInWith({ "/Tune.ashx": "http://a.example/1.mp3" })),
    ),
  );

  it.effect("plays a station without waiting long for its description", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild((yield* TuneIn).station("s1"));
      yield* TestClock.adjust("4 seconds");
      assert.deepStrictEqual(yield* Fiber.join(fiber), {
        streamUrls: ["http://a.example/1.mp3"],
        name: "",
        imageUrl: "",
      });
    }).pipe(
      Effect.provide(
        tuneInWith({
          "/Tune.ashx": "http://a.example/1.mp3",
          "/describe.ashx": null,
        }),
      ),
    ),
  );

  it.effect("reports a station TuneIn has no stream for", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip((yield* TuneIn).station("s9"));
      assert.strictEqual(error._tag, "StationNotFound");
    }).pipe(Effect.provide(tuneInWith({ "/Tune.ashx": "#STATUS: 400\n" }))),
  );

  it.effect("reports TuneIn failing", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip((yield* TuneIn).station("s1"));
      assert.strictEqual(error._tag, "TuneInUnavailable");
    }).pipe(Effect.provide(tuneInWith({}))),
  );

  it.effect("asks TuneIn once per station for five minutes", () => {
    const seen: URL[] = [];
    const tuneRequests = () =>
      seen.filter((url) => url.pathname === "/Tune.ashx").length;
    return Effect.gen(function* () {
      const tuneIn = yield* TuneIn;
      yield* tuneIn.station("s1");
      yield* TestClock.adjust("4 minutes");
      yield* tuneIn.station("s1");
      assert.strictEqual(tuneRequests(), 1);

      yield* TestClock.adjust("1 minute");
      yield* tuneIn.station("s1");
      assert.strictEqual(tuneRequests(), 2);
    }).pipe(
      Effect.provide(
        tuneInWith(
          {
            "/Tune.ashx": "http://a.example/1.mp3",
            "/describe.ashx": DESCRIBE_XML,
          },
          seen,
        ),
      ),
    );
  });

  it.effect("asks TuneIn again right after it failed", () => {
    const routes: Record<string, string> = {};
    return Effect.gen(function* () {
      const tuneIn = yield* TuneIn;
      yield* Effect.flip(tuneIn.station("s1"));
      routes["/Tune.ashx"] = "http://a.example/1.mp3";
      const station = yield* tuneIn.station("s1");
      assert.deepStrictEqual(station.streamUrls, ["http://a.example/1.mp3"]);
    }).pipe(Effect.provide(tuneInWith(routes)));
  });
});
