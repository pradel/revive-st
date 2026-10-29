import { Buffer } from "node:buffer";

import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
  HttpIncomingMessage,
} from "effect/http";

import { BmxPlayback, BmxRegistry } from "./api/bmx.ts";
import { BOSE_XML_CONTENT_TYPE } from "./api/marge.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";

const TestLayer = HttpAppLayer.pipe(
  Layer.provide(PresetsRepo.layerTest),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

const devicePath = (deviceId: string) =>
  `/streaming/account/revivest-user/device/${deviceId}`;

const putPreset = (
  deviceId: string,
  presetId: number,
  body: string,
  contentType = BOSE_XML_CONTENT_TYPE,
) =>
  HttpClient.execute(
    HttpClientRequest.put(`${devicePath(deviceId)}/preset/${presetId}`).pipe(
      HttpClientRequest.bodyText(body, contentType),
    ),
  );

const getPresetsXml = (deviceId: string) =>
  HttpClient.get(`${devicePath(deviceId)}/presets`).pipe(
    Effect.flatMap((response) => response.text),
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

const LOCAL_RADIO_SOURCE_XML =
  '<source id="1" type="Audio"><createdOn>2012-09-19T12:43:00.000+00:00</createdOn><credential type="token"></credential><name>LOCAL_INTERNET_RADIO</name><sourceproviderid>10003</sourceproviderid><sourcename>Local Radio Source</sourcename><sourceSettings/><updatedOn>2012-09-19T12:43:00.000+00:00</updatedOn><username>revivest-user</username></source>';

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

  it.effect("offers the local radio source in the account", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        "/streaming/account/revivest-user/full",
      );
      const body = yield* assertBoseXml(response);
      assert.isString(response.headers.etag);
      assert.include(body, `<sources>${LOCAL_RADIO_SOURCE_XML}</sources>`);
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

  it.effect(
    "recognises a station saved under a Bose cloud source id by its location",
    () =>
      Effect.gen(function* () {
        const saved = yield* putPreset(
          "bose-era",
          1,
          speakerPresetXml({ sourceId: "9330201", name: "Radio" }),
        );
        assert.strictEqual(saved.status, 200);
        assert.include(
          yield* getPresetsXml("bose-era"),
          LOCAL_RADIO_SOURCE_XML,
        );
      }),
  );

  it.effect("rejects a preset from a source the account lacks", () =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        "tunein",
        6,
        speakerPresetXml({
          sourceId: "TUNEIN",
          name: "SMOOTH JAZZ",
          location: "/v1/playback/station/s166521",
        }),
      );
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml("tunein"), "<presets/>");
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
        "text/plain",
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

  it.effect("serves presets synced by the app, in preset order", () =>
    Effect.gen(function* () {
      const contentItem = (itemName: string) => ({
        source: "LOCAL_INTERNET_RADIO",
        type: "stationurl",
        location: STATION_LOCATION,
        sourceAccount: "revivest-user",
        isPresetable: true,
        itemName,
      });
      const response = yield* HttpClient.execute(
        HttpClientRequest.post("/api/internal/device/app-sync/presets").pipe(
          HttpClientRequest.bodyJsonUnsafe({
            presets: [
              { id: 4, contentItem: contentItem("Four") },
              { id: 1, createdOn: 1000, contentItem: contentItem("One") },
            ],
          }),
        ),
      );
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(yield* response.json, { success: true });

      const body = yield* getPresetsXml("app-sync");
      assert.match(
        body,
        /<preset buttonNumber="1"><containerArt><\/containerArt><contentItemType>stationurl<\/contentItemType><createdOn>1970-01-01T00:00:01\.000\+00:00<\/createdOn>[^]*<preset buttonNumber="4">/,
      );
    }),
  );

  it.effect("rejects synced presets that do not match the schema", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.execute(
        HttpClientRequest.post(
          "/api/internal/device/app-sync-invalid/presets",
        ).pipe(HttpClientRequest.bodyJsonUnsafe({ presets: [{ id: 1 }] })),
      );
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml("app-sync-invalid"), "<presets/>");
    }),
  );

  it.effect("serves an empty software update", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        "/streaming/software/update/account/revivest-user",
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
        `<?xml version="1.0" encoding="UTF-8" ?><recent><sourceid>10004</sourceid><name>SMOOTH JAZZ</name><location>/v1/playback/station/s166521</location><contentItemType>stationurl</contentItemType></recent>`,
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
          HttpClientRequest.post(
            `/streaming/account/revivest-user${suffix}`,
          ).pipe(
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
      const [service] = forwarded.bmx_services;
      assert.strictEqual(service.id.name, "LOCAL_INTERNET_RADIO");
      assert.strictEqual(service.id.value, 11);
      assert.strictEqual(
        service.baseUrl,
        "https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion",
      );
      assert.strictEqual(
        service.assets.icons.monochromePng,
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
