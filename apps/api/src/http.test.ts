import { Buffer } from "node:buffer";

import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Logger, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
  HttpIncomingMessage,
} from "effect/http";

import { BmxPlayback, BmxRegistry, BmxToken } from "./api/bmx.ts";
import { BOSE_XML_CONTENT_TYPE } from "./api/marge.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { StationNotFound, TuneIn, TuneInUnavailable } from "./tunein/tunein.ts";

/** TuneIn as the tests need it: `s1` plays, `s404` is gone, `s503` fails. */
const TuneInTest = Layer.succeed(
  TuneIn,
  TuneIn.of({
    station: (stationId) => {
      switch (stationId) {
        case "s404":
          return Effect.fail(new StationNotFound({ stationId }));
        case "s503":
          return Effect.fail(new TuneInUnavailable({ reason: "down" }));
        default:
          return Effect.succeed({
            streamUrls: ["http://a.example/1.mp3", "http://a.example/2.aac"],
            name: "Smooth Jazz",
            imageUrl: "https://cdn.example/logo.png",
          });
      }
    },
  }),
);

/** Every log line the server writes, as JSON. */
const logLines: string[] = [];

const TestLayer = HttpAppLayer.pipe(
  Layer.provide([
    PresetsRepo.layerTest,
    TuneInTest,
    Logger.layer([
      Logger.map(Logger.formatJson, (line) => {
        logLines.push(line);
      }),
    ]),
  ]),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

/** The account the tests' speakers are paired with. */
const ACCOUNT = "household-1";

const devicePath = (deviceId: string, accountId = ACCOUNT) =>
  `/streaming/account/${accountId}/device/${deviceId}`;

const putPreset = (
  deviceId: string,
  presetId: number,
  body: string,
  { contentType = BOSE_XML_CONTENT_TYPE, accountId = ACCOUNT } = {},
) =>
  HttpClient.execute(
    HttpClientRequest.put(
      `${devicePath(deviceId, accountId)}/preset/${presetId}`,
    ).pipe(HttpClientRequest.bodyText(body, contentType)),
  );

const getPresetsXml = (deviceId: string, accountId = ACCOUNT) =>
  HttpClient.get(`${devicePath(deviceId, accountId)}/presets`).pipe(
    Effect.flatMap((response) => response.text),
  );

const syncPresets = (deviceId: string, presets: unknown, accountId = ACCOUNT) =>
  HttpClient.execute(
    HttpClientRequest.post(
      `/api/internal/account/${accountId}/device/${deviceId}/presets`,
    ).pipe(HttpClientRequest.bodyJsonUnsafe({ presets })),
  );

const mintAccountId = HttpClient.post("/api/internal/accounts").pipe(
  Effect.flatMap(
    HttpIncomingMessage.schemaBodyJson(
      Schema.Struct({ accountId: Schema.String }),
    ),
  ),
  Effect.map(({ accountId }) => accountId),
);

const STATION_LOCATION =
  "https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion/station?data=eyJ9";

/** The document a speaker PUTs, as captured from SoundTouch firmware. */
const speakerPresetXml = ({
  sourceId = "1",
  name,
  location = STATION_LOCATION,
  art = "",
}: {
  sourceId?: string;
  name: string;
  location?: string;
  art?: string;
}) =>
  `<?xml version="1.0" encoding="UTF-8" ?><preset buttonNumber="1"><sourceid>${sourceId}</sourceid><name>${name}</name><username>${name}</username><location>${location}</location><contentItemType>stationurl</contentItemType><containerArt>${art}</containerArt></preset>`;

const LOCAL_RADIO_SOURCE_XML = `<source id="1" type="Audio"><createdOn>2012-09-19T12:43:00.000+00:00</createdOn><credential type="token"></credential><name>LOCAL_INTERNET_RADIO</name><sourceproviderid>10003</sourceproviderid><sourcename>Local Radio Source</sourcename><sourceSettings/><updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn><username>${ACCOUNT}</username></source>`;

const TUNEIN_SOURCE_XML =
  '<source id="10004" type="Audio"><createdOn>2017-07-20T16:43:48.000+00:00</createdOn><credential type="token">eyJzZXJpYWwiOiJ0dW5laW4ifQ==</credential><name>TUNEIN</name><sourceproviderid>25</sourceproviderid><sourcename></sourcename><sourceSettings/><updatedOn>2017-07-20T16:43:48.000+00:00</updatedOn><username></username></source>';

const SPOTIFY_LOCATION = "/playback/container/c3BvdGlmeTphbGJ1bQ==";

const MARGE_DATE = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+00:00`;

/** `text` as a literal pattern inside a `RegExp`. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertBoseXml = (response: HttpClientResponse.HttpClientResponse) =>
  Effect.gen(function* () {
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers["content-type"], BOSE_XML_CONTENT_TYPE);
    const body = yield* response.text;
    assert.match(
      body,
      /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/,
    );
    return body;
  });

const getIfNoneMatch = (path: string, etag: string) =>
  HttpClient.execute(
    HttpClientRequest.get(path).pipe(
      HttpClientRequest.setHeader("if-none-match", etag),
    ),
  );

const postRecent = (body: string) =>
  HttpClient.execute(
    HttpClientRequest.post(`${devicePath("dev-1")}/recent`).pipe(
      HttpClientRequest.bodyText(body, BOSE_XML_CONTENT_TYPE),
    ),
  );

/** URL-safe base64 of UTF-8 JSON, as the app encodes station data. */
const encodeStation = (station: object) =>
  Buffer.from(JSON.stringify(station)).toString("base64url");

const stationPath = "/core02/svc-bmx-adapter-orion/prod/orion/station";

// The server runs on live services: it stamps presets with the real clock.
layer(TestLayer, { excludeTestServices: true })("HTTP API", (it) => {
  it.effect("serves the source providers", () =>
    Effect.gen(function* () {
      const body = yield* assertBoseXml(
        yield* HttpClient.get("/streaming/sourceproviders"),
      );
      assert.include(
        body,
        '<sourceprovider id="10003"><createdOn>2012-09-19T12:43:00.000+00:00</createdOn><name>LOCAL_INTERNET_RADIO</name>',
      );
      assert.include(
        body,
        '<sourceprovider id="25"><createdOn>2016-04-08T17:27:21.000+00:00</createdOn><name>TUNEIN</name>',
      );
    }),
  );

  it.effect("answers a matching If-None-Match with a bare 304", () =>
    Effect.gen(function* () {
      const first = yield* HttpClient.get("/streaming/sourceproviders");
      const etag = first.headers.etag;
      assert.isString(etag);

      const unchanged = yield* getIfNoneMatch(
        "/streaming/sourceproviders",
        etag,
      );
      assert.strictEqual(unchanged.status, 304);
      assert.strictEqual(yield* unchanged.text, "");

      const stale = yield* getIfNoneMatch("/streaming/sourceproviders", "old");
      assert.strictEqual(stale.status, 200);
    }),
  );

  it.effect("offers local radio and TuneIn sources in the account", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `/streaming/account/${ACCOUNT}/full`,
      );
      const body = yield* assertBoseXml(response);
      assert.isString(response.headers.etag);
      assert.include(
        body,
        `<sources>${LOCAL_RADIO_SOURCE_XML}${TUNEIN_SOURCE_XML}</sources>`,
      );
    }),
  );

  it.effect("escapes the account id in the account document", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `/streaming/account/${encodeURIComponent('a&"b')}/full`,
      );
      const body = yield* assertBoseXml(response);
      assert.include(body, '<account id="a&amp;&quot;b">');
      assert.include(body, "<username>a&amp;&quot;b</username>");
    }),
  );

  it.effect(
    "stores a preset the speaker PUTs and serves it in Marge's shape",
    () =>
      Effect.gen(function* () {
        const saved = yield* putPreset(
          "put-roundtrip",
          2,
          speakerPresetXml({
            name: "Dance Wave!",
            art: "https://cdn.example/logo.png",
          }),
        );
        const echoed = yield* assertBoseXml(saved);

        const response = yield* HttpClient.get(
          `${devicePath("put-roundtrip")}/presets`,
        );
        const body = yield* assertBoseXml(response);
        assert.isString(response.headers.etag);
        const preset = new RegExp(
          `<preset buttonNumber="2"><containerArt>https://cdn\\.example/logo\\.png</containerArt><contentItemType>stationurl</contentItemType><createdOn>${MARGE_DATE}</createdOn><location>${literal(STATION_LOCATION)}</location><name>Dance Wave!</name>${literal(LOCAL_RADIO_SOURCE_XML)}<updatedOn>${MARGE_DATE}</updatedOn><username>Dance Wave!</username></preset>`,
        );
        assert.match(body, preset);
        assert.match(echoed, preset);
      }),
  );

  it.effect.each([
    ["a source the account lacks", "10863533", SPOTIFY_LOCATION],
    ["a source id the account never handed out", "9330201", STATION_LOCATION],
  ])("rejects a preset from %s", ([, sourceId, location]) =>
    Effect.gen(function* () {
      const device = `rejected-${sourceId}`;
      const response = yield* putPreset(
        device,
        6,
        speakerPresetXml({ sourceId, name: "Radio", location }),
      );
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml(device), "<presets/>");
    }),
  );

  it.effect.each(["TUNEIN", "10004"])(
    "stores a TuneIn preset saved under source id %s",
    (sourceId) =>
      Effect.gen(function* () {
        const device = `tunein-${sourceId}`;
        const saved = yield* putPreset(
          device,
          6,
          speakerPresetXml({
            sourceId,
            name: "SMOOTH JAZZ",
            location: "/v1/playback/station/s166521",
          }),
        );
        assert.strictEqual(saved.status, 200);
        const body = yield* getPresetsXml(device);
        assert.include(
          body,
          `<location>/v1/playback/station/s166521</location><name>SMOOTH JAZZ</name>${TUNEIN_SOURCE_XML}`,
        );
      }),
  );

  it.effect("changes the presets ETag when a preset changes", () =>
    Effect.gen(function* () {
      const path = `${devicePath("etag")}/presets`;
      const before = (yield* HttpClient.get(path)).headers.etag;
      assert.isString(before);
      yield* putPreset("etag", 1, speakerPresetXml({ name: "New" }));

      const after = yield* getIfNoneMatch(path, before);
      assert.strictEqual(after.status, 200);
      assert.include(yield* after.text, "<name>New</name>");
    }),
  );

  it.effect("accepts preset XML whatever its declared content type", () =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        "put-any-type",
        1,
        speakerPresetXml({ name: "Radio" }),
        { contentType: "text/plain" },
      );
      assert.strictEqual(response.status, 200);
      assert.include(
        yield* getPresetsXml("put-any-type"),
        "<name>Radio</name>",
      );
    }),
  );

  it.effect.each([0, 7])("rejects preset id %d", (presetId) =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        "put-out-of-range",
        presetId,
        speakerPresetXml({ name: "Radio" }),
      );
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml("put-out-of-range"), "<presets/>");
    }),
  );

  it.effect("rejects a preset body that is not XML", () =>
    Effect.gen(function* () {
      const response = yield* putPreset("put-invalid", 2, "invalid xml");
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml("put-invalid"), "<presets/>");
    }),
  );

  it.effect("serves no presets for an unknown device", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `${devicePath("unknown")}/presets`,
      );
      assert.include(yield* assertBoseXml(response), "<presets/>");
    }),
  );

  it.effect("keeps presets apart between accounts sharing a device id", () =>
    Effect.gen(function* () {
      yield* putPreset("shared-device", 1, speakerPresetXml({ name: "Ours" }));

      assert.include(
        yield* getPresetsXml("shared-device", "household-2"),
        "<presets/>",
      );
    }),
  );

  it.effect("mints a distinct account id per request", () =>
    Effect.gen(function* () {
      const first = yield* mintAccountId;
      const second = yield* mintAccountId;
      assert.match(
        first,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      assert.notStrictEqual(first, second);
    }),
  );

  it.effect("never logs an account id", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      yield* putPreset("logged", 1, speakerPresetXml({ name: "FIP" }), {
        accountId,
      });
      yield* getPresetsXml("logged", accountId);
      yield* syncPresets("logged", [], accountId);
      yield* HttpClient.get(`/streaming/account/${accountId}/unknown-route`);
      yield* HttpClient.get(`/streaming/account/${accountId}/full`);

      // Unrouted speaker calls stay visible, with their status.
      assert.isTrue(
        logLines.some(
          (line) =>
            line.includes("No route for request") &&
            line.includes("/streaming/account/…/unknown-route") &&
            line.includes("404"),
        ),
      );
      for (const line of logLines) {
        assert.notInclude(line, accountId);
      }
    }),
  );

  it.effect("serves presets synced by the app, in preset order", () =>
    Effect.gen(function* () {
      const contentItem = (itemName: string) => ({
        source: "LOCAL_INTERNET_RADIO",
        type: "stationurl",
        location: STATION_LOCATION,
        sourceAccount: ACCOUNT,
        isPresetable: true,
        itemName,
        containerArt: "",
      });
      const response = yield* syncPresets("app-sync", [
        { id: 4, contentItem: contentItem("Four") },
        { id: 1, createdOn: 1000, contentItem: contentItem("One") },
      ]);
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(yield* response.json, { success: true });

      const body = yield* getPresetsXml("app-sync");
      assert.match(
        body,
        /<preset buttonNumber="1"><containerArt><\/containerArt><contentItemType>stationurl<\/contentItemType><createdOn>1970-01-01T00:00:01\.000\+00:00<\/createdOn>[^]*<preset buttonNumber="4">/,
      );
      assert.include(
        yield* getPresetsXml("app-sync", "household-2"),
        "<presets/>",
      );
    }),
  );

  it.effect("drops synced presets from a source the account lacks", () =>
    Effect.gen(function* () {
      const response = yield* syncPresets("app-sync-mixed", [
        {
          id: 1,
          contentItem: {
            source: "SPOTIFY",
            type: "tracklisturl",
            location: SPOTIFY_LOCATION,
            sourceAccount: "",
            isPresetable: true,
            itemName: "SMOOTH JAZZ",
            containerArt: "",
          },
        },
        {
          id: 2,
          contentItem: {
            source: "LOCAL_INTERNET_RADIO",
            type: "stationurl",
            location: STATION_LOCATION,
            sourceAccount: ACCOUNT,
            isPresetable: true,
            itemName: "FIP",
            containerArt: "",
          },
        },
      ]);
      assert.strictEqual(response.status, 200);

      const body = yield* getPresetsXml("app-sync-mixed");
      assert.notInclude(body, 'buttonNumber="1"');
      assert.include(body, `<preset buttonNumber="2">`);
      assert.include(body, LOCAL_RADIO_SOURCE_XML);
    }),
  );

  it.effect("rejects synced presets that do not match the schema", () =>
    Effect.gen(function* () {
      const response = yield* syncPresets("app-sync-invalid", [{ id: 1 }]);
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml("app-sync-invalid"), "<presets/>");
    }),
  );

  it.effect("serves an empty software update", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `/streaming/software/update/account/${ACCOUNT}`,
      );
      assert.include(
        yield* assertBoseXml(response),
        "<softwareUpdateLocation></softwareUpdateLocation>",
      );
    }),
  );

  it.effect("acknowledges a recent with the source it played from", () =>
    Effect.gen(function* () {
      const response = yield* postRecent(
        `<?xml version="1.0" encoding="UTF-8" ?><recent><lastplayedat>2026-03-29T21:33:00+00:00</lastplayedat><sourceid>1</sourceid><name>FIP</name><location>${STATION_LOCATION}</location><contentItemType>stationurl</contentItemType></recent>`,
      );
      assert.strictEqual(response.status, 201);
      assert.strictEqual(
        response.headers["content-type"],
        BOSE_XML_CONTENT_TYPE,
      );
      assert.isUndefined(response.headers.location);
      assert.match(
        yield* response.text,
        new RegExp(
          `<recent id="\\d+"><contentItemType>stationurl</contentItemType><createdOn>${MARGE_DATE}</createdOn><lastplayedat>2026-03-29T21:33:00\\.000\\+00:00</lastplayedat><location>${literal(STATION_LOCATION)}</location><name>FIP</name>${literal(LOCAL_RADIO_SOURCE_XML)}<sourceid>1</sourceid>`,
        ),
      );
    }),
  );

  it.effect("rejects a recent from a source the account lacks", () =>
    Effect.gen(function* () {
      const response = yield* postRecent(
        `<?xml version="1.0" encoding="UTF-8" ?><recent><sourceid>10863533</sourceid><name>Album</name><location>${SPOTIFY_LOCATION}</location><contentItemType>tracklisturl</contentItemType></recent>`,
      );
      assert.strictEqual(response.status, 400);
    }),
  );

  it.effect("acknowledges power on", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.execute(
        HttpClientRequest.post("/streaming/support/power_on").pipe(
          HttpClientRequest.bodyText(
            `<?xml version="1.0" encoding="UTF-8" ?><device-data><device id="EC1127C25A50"><serialnumber>55307133203739342000010</serialnumber></device></device-data>`,
            BOSE_XML_CONTENT_TYPE,
          ),
        ),
      );
      assert.include(yield* assertBoseXml(response), "<status>OK</status>");
    }),
  );

  it.effect.each(["/device", "/device/"])(
    "registers a device at %s",
    (suffix) =>
      Effect.gen(function* () {
        const response = yield* HttpClient.execute(
          HttpClientRequest.post(`/streaming/account/${ACCOUNT}${suffix}`).pipe(
            HttpClientRequest.bodyText(
              `<?xml version="1.0" encoding="UTF-8" ?><device deviceid="EC1127C25A50"><name>Bose SoundTouch 10</name></device>`,
              BOSE_XML_CONTENT_TYPE,
            ),
          ),
        );
        assert.include(yield* assertBoseXml(response), "<status>OK</status>");
      }),
  );

  it.effect("points the BMX registry at the host the speaker called", () =>
    Effect.gen(function* () {
      const forwarded = yield* HttpClient.execute(
        HttpClientRequest.get("/v2/registry.json").pipe(
          HttpClientRequest.setHeaders({
            "x-forwarded-for": "203.0.113.7",
            "x-forwarded-host": "api.revivest.app",
            "x-forwarded-proto": "https",
          }),
        ),
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxRegistry)));
      assert.deepStrictEqual(
        forwarded.bmx_services.map((service) => [
          service.id.name,
          service.id.value,
          service.baseUrl,
        ]),
        [
          [
            "LOCAL_INTERNET_RADIO",
            11,
            "https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion",
          ],
          ["TUNEIN", 25, "https://api.revivest.app/bmx/tunein"],
        ],
      );
      assert.strictEqual(
        forwarded.bmx_services[0].assets.icons.monochromePng,
        "https://api.revivest.app/media/orion-monochrome_v2.png",
      );

      const direct = yield* HttpClient.get("/v2/registry.json").pipe(
        Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxRegistry)),
      );
      assert.match(
        direct.bmx_services[0].baseUrl,
        /^http:\/\/127\.0\.0\.1:\d+\/core02\/svc-bmx-adapter-orion\/prod\/orion$/,
      );
    }),
  );

  it.effect("serves the registry icons", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/media/orion-monochrome.svg");
      assert.strictEqual(response.status, 200);
      assert.match(response.headers["content-type"] ?? "", /^image\/svg\+xml/);
      assert.include(yield* response.text, "<svg");
    }),
  );

  it.effect.each([
    "/core02/svc-bmx-adapter-orion/prod/orion/token",
    "/bmx/tunein/v1/token",
  ])("hands out a non-empty anonymous token at %s", (path) =>
    Effect.gen(function* () {
      const token = yield* HttpClient.execute(
        HttpClientRequest.post(path).pipe(
          HttpClientRequest.bodyJsonUnsafe({ grant_type: "refresh_token" }),
        ),
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxToken)));
      assert.isNotEmpty(token.access_token);
      assert.isNotEmpty(token.refresh_token);
    }),
  );

  it.effect("plays a TuneIn station from its streams", () =>
    Effect.gen(function* () {
      const playback = yield* HttpClient.get(
        "/bmx/tunein/v1/playback/station/s1",
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxPlayback)));
      const stream = (streamUrl: string) => ({
        hasPlaylist: true,
        isRealtime: true,
        streamUrl,
      });
      assert.deepStrictEqual(playback, {
        audio: {
          ...stream("http://a.example/1.mp3"),
          streams: [
            stream("http://a.example/1.mp3"),
            stream("http://a.example/2.aac"),
          ],
        },
        imageUrl: "https://cdn.example/logo.png",
        name: "Smooth Jazz",
        streamType: "liveRadio",
      });
    }),
  );

  it.effect.each([
    ["an unknown station", "s404", 404],
    ["TuneIn being down", "s503", 503],
    ["a malformed station id", "../x", 400],
  ] as const)("fails a TuneIn station for %s", ([, stationId, status]) =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `/bmx/tunein/v1/playback/station/${encodeURIComponent(stationId)}`,
      );
      assert.strictEqual(response.status, status);
    }),
  );

  it.effect("acknowledges TuneIn listening reports", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.execute(
        HttpClientRequest.post(
          "/bmx/tunein/v1/report?stream_id=e1&guide_id=s1&listen_id=1&stream_type=liveRadio",
        ).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            eventType: "START",
            reason: "USER_SELECT_PLAYABLE",
          }),
        ),
      );
      assert.strictEqual(response.status, 200);
    }),
  );

  it.effect("plays a station encoded by the app", () =>
    Effect.gen(function* () {
      const name = "Éveil & München & Русский";
      const data = encodeStation({
        streamUrl: "http://stream.example.com",
        name,
        imageUrl: "http://image.example.com/art.png",
      });
      const playback = yield* HttpClient.get(
        `${stationPath}?data=${encodeURIComponent(data)}`,
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxPlayback)));
      assert.deepStrictEqual(playback, {
        audio: {
          hasPlaylist: true,
          isRealtime: true,
          streamUrl: "http://stream.example.com",
          streams: [
            {
              hasPlaylist: true,
              isRealtime: true,
              streamUrl: "http://stream.example.com",
            },
          ],
        },
        imageUrl: "http://image.example.com/art.png",
        name,
        streamType: "liveRadio",
      });
    }),
  );

  it.effect("defaults a station's name and image", () =>
    Effect.gen(function* () {
      const data = encodeStation({ streamUrl: "http://stream.example.com" });
      const playback = yield* HttpClient.get(
        `${stationPath}?data=${data}`,
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxPlayback)));
      assert.strictEqual(playback.name, "Custom Stream");
      assert.strictEqual(playback.imageUrl, "");
    }),
  );

  it.effect.each([
    ["missing data", ""],
    ["data that is not base64", "?data=%25%25%25"],
    ["data that is not JSON", `?data=${encodeStation({}).slice(1)}`],
    ["a station without a stream", `?data=${encodeStation({ name: "x" })}`],
  ])("rejects a station with %s", ([, query]) =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(`${stationPath}${query}`);
      assert.strictEqual(response.status, 400);
    }),
  );
});
