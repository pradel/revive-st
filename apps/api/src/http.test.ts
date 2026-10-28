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

const speakerPresetXml = (name: string, location: string) =>
  `<?xml version="1.0" encoding="UTF-8" ?><preset buttonNumber="1"><sourceid>1</sourceid><name>${name}</name><username>${name}</username><location>${location}</location><contentItemType>stationurl</contentItemType><containerArt></containerArt></preset>`;

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

/** URL-safe base64 of UTF-8 JSON, as the app encodes station data. */
const encodeStation = (station: object) =>
  Buffer.from(JSON.stringify(station)).toString("base64url");

const stationPath = "/core02/svc-bmx-adapter-orion/prod/orion/station";

// The server runs on live services: it stamps presets with the real clock.
layer(TestLayer, { excludeTestServices: true })("HTTP API", (it) => {
  it.effect("serves the source providers with an ETag", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/streaming/sourceproviders");
      const body = yield* assertBoseXml(response);
      assert.strictEqual(response.headers.etag, "1");
      assert.include(body, '<sourceprovider id="10003">');
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

  it.effect("stores a preset the speaker PUTs and serves it back", () =>
    Effect.gen(function* () {
      const location =
        "https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion/station?data=eyJ9";
      const saved = yield* putPreset(
        "put-roundtrip",
        2,
        speakerPresetXml("Dance Wave!", location),
      );
      assert.include(yield* assertBoseXml(saved), "<status>OK</status>");

      const response = yield* HttpClient.get(
        `${devicePath("put-roundtrip")}/presets`,
      );
      const body = yield* assertBoseXml(response);
      assert.strictEqual(response.headers.etag, "1");
      assert.match(body, /<preset id="2" createdOn="\d+" updatedOn="\d+">/);
      assert.include(
        body,
        `<ContentItem source="LOCAL_INTERNET_RADIO" location="${location}" sourceAccount="revivest-user" isPresetable="true">`,
      );
      assert.include(body, "<itemName>Dance Wave!</itemName>");
    }),
  );

  it.effect("accepts preset XML whatever its declared content type", () =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        "put-any-type",
        1,
        speakerPresetXml("Radio", "loc"),
        "text/plain",
      );
      assert.strictEqual(response.status, 200);
      assert.include(yield* getPresetsXml("put-any-type"), "Radio");
    }),
  );

  it.effect("defaults a preset without name or location", () =>
    Effect.gen(function* () {
      yield* putPreset("put-defaults", 1, "<preset></preset>");
      const body = yield* getPresetsXml("put-defaults");
      assert.include(body, 'location=""');
      assert.include(body, "<itemName>Unknown Preset</itemName>");
    }),
  );

  it.effect.each([0, 7])("rejects preset id %d", (presetId) =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        "put-out-of-range",
        presetId,
        speakerPresetXml("Radio", "loc"),
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

  it.effect("stores presets synced by the app, in preset order", () =>
    Effect.gen(function* () {
      const contentItem = (itemName: string) => ({
        source: "TUNEIN",
        location: `/v1/playback/station/${itemName}`,
        sourceAccount: "",
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
      assert.match(body, /<preset id="1" createdOn="1000"[^]*<preset id="4"/);
      assert.include(body, 'source="TUNEIN"');
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

  it.effect("acknowledges a recent item with its location", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.post(`${devicePath("dev-1")}/recent`);
      assert.strictEqual(response.status, 201);
      assert.strictEqual(
        response.headers["content-type"],
        BOSE_XML_CONTENT_TYPE,
      );
      assert.strictEqual(
        response.headers.location,
        "http://localhost:8000/account/revivest-user/device/dev-1/recent/1",
      );
      assert.include(yield* response.text, '<recent id="1">');
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
