import { createHash } from "node:crypto";

import { NodeHttpServer } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Logger, References, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
  HttpIncomingMessage,
} from "effect/http";

import packageJson from "../package.json" with { type: "json" };
import { BmxPlayback, BmxRegistry, BmxToken } from "./api/bmx.ts";
import { BOSE_XML_CONTENT_TYPE } from "./api/marge.ts";
import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import {
  DevicesRepo,
  MAX_DEVICES_PER_ACCOUNT,
} from "./devices/devices-repo.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import {
  RadioBrowser,
  RadioBrowserStationNotFound,
  RadioBrowserUnavailable,
} from "./radio-browser/radio-browser.ts";
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

const STATION_UUID = "9610c454-0601-11e8-ae97-52543be04c81";
const MISSING_UUID = "00000000-0000-0000-0000-000000000404";
const UNAVAILABLE_UUID = "00000000-0000-0000-0000-000000000503";

/** Radio Browser as the tests need it: one station, one gone, one failing. */
const RadioBrowserTest = Layer.succeed(
  RadioBrowser,
  RadioBrowser.of({
    station: (stationUuid) => {
      switch (stationUuid) {
        case MISSING_UUID:
          return Effect.fail(new RadioBrowserStationNotFound({ stationUuid }));
        case UNAVAILABLE_UUID:
          return Effect.fail(new RadioBrowserUnavailable({ reason: "down" }));
        default:
          return Effect.succeed({
            streamUrls: ["http://mp3channels.example/chillout"],
            name: "Antenne Bayern - Chillout",
            imageUrl: "https://cdn.example/antenne.png",
          });
      }
    },
  }),
);

/** Every log line the server writes, Debug included, as JSON. */
const logLines: string[] = [];

const TestLayer = HttpAppLayer.pipe(
  Layer.provide([
    PresetsRepo.layerTest,
    DevicesRepo.layerTest,
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

/** The account the tests' speakers are paired with. */
const ACCOUNT = "household-1";

/**
 * A device id as speakers send it, a MAC address, derived from `label` so
 * each test names its own speakers.
 */
const speaker = (label: string) =>
  createHash("sha256").update(label).digest("hex").slice(0, 12).toUpperCase();

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

const STATION_LOCATION = `/stations/byuuid/${STATION_UUID}`;

/** The document a speaker PUTs, as captured from SoundTouch firmware. */
const speakerPresetXml = ({
  sourceId = "10005",
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

const RADIO_BROWSER_SOURCE_XML =
  '<source id="10005" type="Audio"><createdOn>2026-10-30T00:00:00.000+00:00</createdOn><credential type="token">eyJzZXJpYWwiOiJyYWRpb2Jyb3dzZXIifQ==</credential><name>RADIO_BROWSER</name><sourceproviderid>39</sourceproviderid><sourcename></sourcename><sourceSettings/><updatedOn>2026-10-30T00:00:00.000+00:00</updatedOn><username></username></source>';

const TUNEIN_SOURCE_XML =
  '<source id="10004" type="Audio"><createdOn>2017-07-20T16:43:48.000+00:00</createdOn><credential type="token">eyJzZXJpYWwiOiJ0dW5laW4ifQ==</credential><name>TUNEIN</name><sourceproviderid>25</sourceproviderid><sourcename></sourcename><sourceSettings/><updatedOn>2017-07-20T16:43:48.000+00:00</updatedOn><username></username></source>';

const CUSTOM_STATIONS_SOURCE_XML =
  '<source id="10006" type="Audio"><createdOn>2026-10-31T00:00:00.000+00:00</createdOn><credential type="token">eyJzZXJpYWwiOiJjdXN0b20ifQ==</credential><name>LOCAL_INTERNET_RADIO</name><sourceproviderid>11</sourceproviderid><sourcename></sourcename><sourceSettings/><updatedOn>2026-10-31T00:00:00.000+00:00</updatedOn><username></username></source>';

/** A custom station's `data`, as the app and other SoundTouch servers encode it. */
const customStationData = (station: object) =>
  encodeURIComponent(btoa(JSON.stringify(station)));

const SPOTIFY_LOCATION = "/playback/container/c3BvdGlmeTphbGJ1bQ==";

const MARGE_DATE = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+00:00`;

/** `text` as a literal pattern inside a `RegExp`. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertBoseXml = (
  response: HttpClientResponse.HttpClientResponse,
  status = 200,
) =>
  Effect.gen(function* () {
    assert.strictEqual(response.status, status);
    assert.strictEqual(response.headers["content-type"], BOSE_XML_CONTENT_TYPE);
    const body = yield* response.text;
    assert.match(
      body,
      /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/,
    );
    return body;
  });

const getFullXml = (accountId: string) =>
  HttpClient.get(`/streaming/account/${accountId}/full`).pipe(
    Effect.flatMap((response) => response.text),
  );

const registerDevice = (deviceId: string, accountId: string) =>
  HttpClient.execute(
    HttpClientRequest.post(`/streaming/account/${accountId}/device/`).pipe(
      HttpClientRequest.bodyText(
        `<?xml version="1.0" encoding="UTF-8" ?><device deviceid="${deviceId}"><name>Bose SoundTouch 10</name><macaddress>${deviceId}</macaddress></device>`,
        BOSE_XML_CONTENT_TYPE,
      ),
    ),
  );

/** The `<device>` ids listed in an account document, in order. */
const listedDeviceIds = (fullXml: string) =>
  [...fullXml.matchAll(/<device deviceid="([^"]*)">/g)].map(([, id]) => id);

const getIfNoneMatch = (path: string, etag: string) =>
  HttpClient.execute(
    HttpClientRequest.get(path).pipe(
      HttpClientRequest.setHeader("if-none-match", etag),
    ),
  );

const postRecent = (body: string) =>
  HttpClient.execute(
    HttpClientRequest.post(`${devicePath(speaker("dev-1"))}/recent`).pipe(
      HttpClientRequest.bodyText(body, BOSE_XML_CONTENT_TYPE),
    ),
  );

const postPowerOn = (body: string) =>
  HttpClient.execute(
    HttpClientRequest.post("/streaming/support/power_on").pipe(
      HttpClientRequest.bodyText(body, BOSE_XML_CONTENT_TYPE),
    ),
  );

/** The speaker's last contact, as the app reads it. */
const getLastContactAt = (deviceId: string) =>
  HttpClient.get(`/api/internal/device/${deviceId}/contact`).pipe(
    Effect.flatMap(
      HttpIncomingMessage.schemaBodyJson(
        Schema.Struct({ lastContactAt: Schema.NullOr(Schema.Number) }),
      ),
    ),
    Effect.map(({ lastContactAt }) => lastContactAt),
  );

/**
 * Runs `request` and asserts it recorded `deviceId`'s contact: never
 * contacted before, contacted while it ran after.
 */
const assertRecordsContact = <Success, Failure, Requirements>(
  deviceId: string,
  request: Effect.Effect<Success, Failure, Requirements>,
) =>
  Effect.gen(function* () {
    assert.isNull(yield* getLastContactAt(deviceId));
    const before = DateTime.toEpochMillis(yield* DateTime.now);
    const result = yield* request;
    const after = DateTime.toEpochMillis(yield* DateTime.now);
    const lastContactAt = yield* getLastContactAt(deviceId);
    assert.isNotNull(lastContactAt);
    assert.isAtLeast(lastContactAt, before);
    assert.isAtMost(lastContactAt, after);
    return result;
  });

// The server runs on live services: it stamps presets with the real clock.
layer(TestLayer, { excludeTestServices: true })("HTTP API", (it) => {
  it.effect("answers its root with its version and working doc links", () =>
    Effect.gen(function* () {
      const status = yield* HttpClient.get("/").pipe(
        Effect.flatMap(
          HttpIncomingMessage.schemaBodyJson(
            Schema.Struct({
              version: Schema.String,
              docs: Schema.String,
              openapi: Schema.String,
            }),
          ),
        ),
      );
      assert.strictEqual(status.version, packageJson.version);
      for (const path of [status.docs, status.openapi]) {
        const response = yield* HttpClient.get(path);
        assert.strictEqual(response.status, 200, path);
      }
    }),
  );

  it.effect("serves the source providers", () =>
    Effect.gen(function* () {
      const body = yield* assertBoseXml(
        yield* HttpClient.get("/streaming/sourceproviders"),
      );
      assert.include(
        body,
        '<sourceprovider id="39"><createdOn>2026-10-30T00:00:00.000+00:00</createdOn><name>RADIO_BROWSER</name>',
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

  it.effect(
    "offers TuneIn, Radio Browser and custom stations sources in the account",
    () =>
      Effect.gen(function* () {
        const response = yield* HttpClient.get(
          `/streaming/account/${ACCOUNT}/full`,
        );
        const body = yield* assertBoseXml(response);
        assert.isString(response.headers.etag);
        assert.include(
          body,
          `<sources>${TUNEIN_SOURCE_XML}${RADIO_BROWSER_SOURCE_XML}${CUSTOM_STATIONS_SOURCE_XML}</sources>`,
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
    }),
  );

  it.effect(
    "stores a preset the speaker PUTs and serves it in Marge's shape",
    () =>
      Effect.gen(function* () {
        const saved = yield* putPreset(
          speaker("put-roundtrip"),
          2,
          speakerPresetXml({
            name: "Dance Wave!",
            art: "https://cdn.example/logo.png",
          }),
        );
        const echoed = yield* assertBoseXml(saved);

        const response = yield* HttpClient.get(
          `${devicePath(speaker("put-roundtrip"))}/presets`,
        );
        const body = yield* assertBoseXml(response);
        assert.isString(response.headers.etag);
        const preset = new RegExp(
          `<preset buttonNumber="2"><containerArt>https://cdn\\.example/logo\\.png</containerArt><contentItemType>stationurl</contentItemType><createdOn>${MARGE_DATE}</createdOn><location>${literal(STATION_LOCATION)}</location><name>Dance Wave!</name>${literal(RADIO_BROWSER_SOURCE_XML)}<updatedOn>${MARGE_DATE}</updatedOn><username>Dance Wave!</username></preset>`,
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
      const device = speaker(`rejected-${sourceId}`);
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
        const device = speaker(`tunein-${sourceId}`);
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
      const path = `${devicePath(speaker("etag"))}/presets`;
      const before = (yield* HttpClient.get(path)).headers.etag;
      assert.isString(before);
      yield* putPreset(speaker("etag"), 1, speakerPresetXml({ name: "New" }));

      const after = yield* getIfNoneMatch(path, before);
      assert.strictEqual(after.status, 200);
      assert.include(yield* after.text, "<name>New</name>");
    }),
  );

  it.effect("accepts preset XML whatever its declared content type", () =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        speaker("put-any-type"),
        1,
        speakerPresetXml({ name: "Radio" }),
        { contentType: "text/plain" },
      );
      assert.strictEqual(response.status, 200);
      assert.include(
        yield* getPresetsXml(speaker("put-any-type")),
        "<name>Radio</name>",
      );
    }),
  );

  it.effect.each([0, 7])("rejects preset id %d", (presetId) =>
    Effect.gen(function* () {
      const response = yield* putPreset(
        speaker("put-out-of-range"),
        presetId,
        speakerPresetXml({ name: "Radio" }),
      );
      assert.strictEqual(response.status, 400);
      assert.include(
        yield* getPresetsXml(speaker("put-out-of-range")),
        "<presets/>",
      );
    }),
  );

  it.effect("rejects a preset body that is not XML", () =>
    Effect.gen(function* () {
      const device = speaker("put-invalid");
      const response = yield* putPreset(device, 2, "invalid xml");
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml(device), "<presets/>");
    }),
  );

  it.effect("serves no presets for an unknown device", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `${devicePath(speaker("unknown"))}/presets`,
      );
      assert.include(yield* assertBoseXml(response), "<presets/>");
    }),
  );

  it.effect("keeps presets apart between accounts sharing a device id", () =>
    Effect.gen(function* () {
      const device = speaker("shared-device");
      yield* putPreset(device, 1, speakerPresetXml({ name: "Ours" }));

      assert.include(yield* getPresetsXml(device, "household-2"), "<presets/>");
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
      yield* putPreset(
        speaker("logged"),
        1,
        speakerPresetXml({ name: "FIP" }),
        {
          accountId,
        },
      );
      yield* getPresetsXml(speaker("logged"), accountId);
      yield* syncPresets(speaker("logged"), [], accountId);
      yield* HttpClient.get(`/streaming/account/${accountId}/unknown-route`);
      yield* HttpClient.get(`/streaming/account/${accountId}/full`);
      yield* HttpClient.execute(
        HttpClientRequest.post(`/streaming/account/${accountId}/device/`).pipe(
          HttpClientRequest.bodyText(
            `<device account="${accountId}"/>`,
            BOSE_XML_CONTENT_TYPE,
          ),
        ),
      );

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

  it.effect("logs rejected requests with what was sent, not served ones", () =>
    Effect.gen(function* () {
      const rejected = "<device><name>No id</name></device>";
      yield* HttpClient.execute(
        HttpClientRequest.post(`/streaming/account/${ACCOUNT}/device/`).pipe(
          HttpClientRequest.bodyText(rejected, BOSE_XML_CONTENT_TYPE),
        ),
      );
      yield* getPresetsXml(speaker("served"));

      const parsed = logLines.map(
        (line) =>
          JSON.parse(line) as {
            level: string;
            annotations: Record<string, unknown>;
          },
      );
      assert.isTrue(
        parsed.some(
          ({ level, annotations }) =>
            level === "WARN" &&
            annotations["http.status"] === 400 &&
            annotations["http.request.body"] === rejected,
        ),
      );
      const served = parsed.filter(
        ({ annotations }) =>
          annotations["http.url"] ===
          `/streaming/account/…/device/${speaker("served")}/presets`,
      );
      assert.isNotEmpty(served);
      for (const { level } of served) {
        assert.strictEqual(level, "DEBUG");
      }
    }),
  );

  it.effect("logs the app version and platform the app names", () =>
    Effect.gen(function* () {
      // Other tests log calls to the same routes.
      const firstLine = logLines.length;
      yield* HttpClient.execute(
        HttpClientRequest.post("/api/internal/accounts").pipe(
          HttpClientRequest.setHeaders({
            "X-Revive-App-Version": "1.2.3",
            "X-Revive-App-Platform": "ios",
          }),
        ),
      );
      yield* HttpClient.get("/v2/registry.json");

      // The test logger writes these lines; their shape is its JSON format.
      const parsed = logLines
        .slice(firstLine)
        .map(
          (line) =>
            JSON.parse(line) as { annotations: Record<string, unknown> },
        );
      const annotationsOf = (url: string) =>
        parsed
          .map(({ annotations }) => annotations)
          .filter((annotations) => annotations["http.url"] === url);
      const fromApp = annotationsOf("/api/internal/accounts");
      assert.isNotEmpty(fromApp);
      for (const annotations of fromApp) {
        assert.strictEqual(annotations["app.version"], "1.2.3");
        assert.strictEqual(annotations["app.platform"], "ios");
      }
      const fromSpeaker = annotationsOf("/v2/registry.json");
      assert.isNotEmpty(fromSpeaker);
      for (const annotations of fromSpeaker) {
        assert.notProperty(annotations, "app.version");
        assert.notProperty(annotations, "app.platform");
      }
    }),
  );

  it.effect("serves presets synced by the app, in preset order", () =>
    Effect.gen(function* () {
      const contentItem = (itemName: string) => ({
        source: "RADIO_BROWSER",
        type: "stationurl",
        location: STATION_LOCATION,
        sourceAccount: "",
        isPresetable: true,
        itemName,
        containerArt: "",
      });
      const response = yield* syncPresets(speaker("app-sync"), [
        { id: 4, contentItem: contentItem("Four") },
        { id: 1, createdOn: 1000, contentItem: contentItem("One") },
      ]);
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(yield* response.json, { success: true });

      const body = yield* getPresetsXml(speaker("app-sync"));
      assert.match(
        body,
        /<preset buttonNumber="1"><containerArt><\/containerArt><contentItemType>stationurl<\/contentItemType><createdOn>1970-01-01T00:00:01\.000\+00:00<\/createdOn>[^]*<preset buttonNumber="4">/,
      );
      assert.include(
        yield* getPresetsXml(speaker("app-sync"), "household-2"),
        "<presets/>",
      );
    }),
  );

  it.effect("drops synced presets from a source the account lacks", () =>
    Effect.gen(function* () {
      const response = yield* syncPresets(speaker("app-sync-mixed"), [
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
            source: "RADIO_BROWSER",
            type: "stationurl",
            location: STATION_LOCATION,
            sourceAccount: "",
            isPresetable: true,
            itemName: "FIP",
            containerArt: "",
          },
        },
      ]);
      assert.strictEqual(response.status, 200);

      const body = yield* getPresetsXml(speaker("app-sync-mixed"));
      assert.notInclude(body, 'buttonNumber="1"');
      assert.include(body, `<preset buttonNumber="2">`);
      assert.include(body, RADIO_BROWSER_SOURCE_XML);
    }),
  );

  it.effect("replaces a device's stored presets with the ones synced", () =>
    Effect.gen(function* () {
      const preset = (id: number, itemName: string) => ({
        id,
        contentItem: {
          source: "RADIO_BROWSER",
          type: "stationurl",
          location: STATION_LOCATION,
          sourceAccount: "",
          isPresetable: true,
          itemName,
          containerArt: "",
        },
      });
      const device = speaker("app-sync-replace");
      const other = speaker("app-sync-replace-other");
      yield* syncPresets(device, [
        preset(1, "One"),
        preset(2, "Two"),
        preset(4, "Four"),
      ]);
      yield* syncPresets(other, [preset(1, "Other")]);

      yield* syncPresets(device, [preset(2, "Two again")]);
      const body = yield* getPresetsXml(device);
      assert.deepStrictEqual(
        [...body.matchAll(/buttonNumber="(\d)"/g)].map(([, id]) => id),
        ["2"],
      );
      assert.include(body, "<name>Two again</name>");

      yield* syncPresets(device, []);
      assert.include(yield* getPresetsXml(device), "<presets/>");
      assert.include(yield* getPresetsXml(other), "<name>Other</name>");
    }),
  );

  it.effect("deletes a preset the speaker removes", () =>
    Effect.gen(function* () {
      const device = speaker("removing");
      yield* putPreset(device, 1, speakerPresetXml({ name: "Kept" }));
      yield* putPreset(device, 3, speakerPresetXml({ name: "Removed" }));

      const response = yield* HttpClient.execute(
        HttpClientRequest.delete(`${devicePath(device)}/preset/3`),
      );
      assert.include(yield* assertBoseXml(response), "<status>OK</status>");

      const body = yield* getPresetsXml(device);
      assert.include(body, "<name>Kept</name>");
      assert.notInclude(body, 'buttonNumber="3"');
    }),
  );

  it.effect("rejects synced presets that do not match the schema", () =>
    Effect.gen(function* () {
      const device = speaker("app-sync-invalid");
      const response = yield* syncPresets(device, [{ id: 1 }]);
      assert.strictEqual(response.status, 400);
      assert.include(yield* getPresetsXml(device), "<presets/>");
    }),
  );

  it.effect("rejects more than one synced preset per button", () =>
    Effect.gen(function* () {
      const preset = (id: number) => ({
        id,
        contentItem: {
          source: "RADIO_BROWSER",
          type: "stationurl",
          location: STATION_LOCATION,
          sourceAccount: "",
          isPresetable: true,
          itemName: `Preset ${id}`,
          containerArt: "",
        },
      });
      const duplicated = yield* syncPresets(speaker("app-sync-duplicate"), [
        preset(1),
        preset(1),
      ]);
      assert.strictEqual(duplicated.status, 400);
      const seven = yield* syncPresets(
        speaker("app-sync-seven"),
        [1, 2, 3, 4, 5, 6, 6].map(preset),
      );
      assert.strictEqual(seven.status, 400);
    }),
  );

  it.effect("stores nothing from a body over 32 KiB", () =>
    Effect.gen(function* () {
      const device = speaker("too-large");
      const longName = "x".repeat(33 * 1024);
      const synced = yield* syncPresets(device, [
        {
          id: 1,
          contentItem: {
            source: "RADIO_BROWSER",
            type: "stationurl",
            location: STATION_LOCATION,
            sourceAccount: "",
            isPresetable: true,
            itemName: longName,
            containerArt: "",
          },
        },
      ]);
      assert.strictEqual(synced.status, 413);
      // Speaker routes read their body themselves: any unreadable body is a 400.
      const put = yield* putPreset(
        device,
        2,
        speakerPresetXml({ name: longName }),
      );
      assert.strictEqual(put.status, 400);
      assert.include(yield* getPresetsXml(device), "<presets/>");
    }),
  );

  it.effect.each([
    ["itemName", "name", 512],
    ["location", "location", 4096],
    ["containerArt", "art", 2048],
  ] as const)(
    "stores a preset %s up to its maximum length, not beyond",
    ([field, speakerField, maxLength]) =>
      Effect.gen(function* () {
        const contentItem = (value: string) => ({
          source: "RADIO_BROWSER",
          type: "stationurl",
          location: STATION_LOCATION,
          sourceAccount: "",
          isPresetable: true,
          itemName: "Radio",
          containerArt: "",
          [field]: value,
        });
        const speakerXml = (value: string) =>
          speakerPresetXml({ name: "Radio", [speakerField]: value });
        const longest = "x".repeat(maxLength);
        const tooLong = "x".repeat(maxLength + 1);

        const synced = speaker(`app-sync-${field}`);
        assert.strictEqual(
          (yield* syncPresets(synced, [
            { id: 1, contentItem: contentItem(longest) },
          ])).status,
          200,
        );
        assert.strictEqual(
          (yield* syncPresets(synced, [
            { id: 2, contentItem: contentItem(tooLong) },
          ])).status,
          400,
        );
        const syncedXml = yield* getPresetsXml(synced);
        assert.include(syncedXml, longest);
        assert.notInclude(syncedXml, tooLong);
        assert.notInclude(syncedXml, 'buttonNumber="2"');

        const saved = speaker(`put-${field}`);
        assert.strictEqual(
          (yield* putPreset(saved, 1, speakerXml(longest))).status,
          200,
        );
        assert.strictEqual(
          (yield* putPreset(saved, 2, speakerXml(tooLong))).status,
          400,
        );
        const savedXml = yield* getPresetsXml(saved);
        assert.include(savedXml, longest);
        assert.notInclude(savedXml, 'buttonNumber="2"');
      }),
  );

  it.effect("stores nothing for a device id that isn't a MAC address", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      const notMac = "not-a-mac-address";
      const saved = yield* putPreset(
        notMac,
        1,
        speakerPresetXml({ name: "Radio" }),
        { accountId },
      );
      const synced = yield* syncPresets(notMac, [], accountId);
      const grouped = yield* HttpClient.get(
        `${devicePath(notMac, accountId)}/group`,
      );
      const registered = yield* registerDevice(notMac, accountId);
      assert.deepStrictEqual(
        [saved.status, synced.status, grouped.status, registered.status],
        [400, 400, 400, 400],
      );
      assert.deepStrictEqual(listedDeviceIds(yield* getFullXml(accountId)), []);
    }),
  );

  it.effect("accepts account ids up to 64 characters, not beyond", () =>
    Effect.gen(function* () {
      const device = speaker("long-account");
      const longest = "a".repeat(64);
      const tooLong = "a".repeat(65);
      const preset = speakerPresetXml({ name: "Radio" });
      assert.strictEqual(
        (yield* putPreset(device, 1, preset, { accountId: longest })).status,
        200,
      );
      assert.strictEqual(
        (yield* putPreset(device, 1, preset, { accountId: tooLong })).status,
        400,
      );
      assert.strictEqual(
        (yield* HttpClient.get(`/streaming/account/${tooLong}/full`)).status,
        400,
      );
    }),
  );

  it.effect(
    `pairs at most ${MAX_DEVICES_PER_ACCOUNT} speakers with an account`,
    () =>
      Effect.gen(function* () {
        const accountId = yield* mintAccountId;
        const deviceIds = Array.from(
          { length: MAX_DEVICES_PER_ACCOUNT },
          (_unused, index) => speaker(`full-${index}`),
        );
        for (const deviceId of deviceIds) {
          assert.strictEqual(
            (yield* syncPresets(deviceId, [], accountId)).status,
            200,
          );
        }

        const extra = speaker("full-extra");
        const synced = yield* syncPresets(extra, [], accountId);
        assert.strictEqual(synced.status, 409);
        const saved = yield* putPreset(
          extra,
          1,
          speakerPresetXml({ name: "Extra" }),
          { accountId },
        );
        assert.strictEqual(saved.status, 400);
        assert.include(yield* getPresetsXml(extra, accountId), "<presets/>");
        assert.sameMembers(
          listedDeviceIds(yield* getFullXml(accountId)),
          deviceIds,
        );
        // A speaker already in the account keeps syncing.
        assert.strictEqual(
          (yield* syncPresets(deviceIds[0], [], accountId)).status,
          200,
        );
      }),
  );

  it.effect("serves the account's provider settings, escaping its id", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `/streaming/account/${encodeURIComponent('a&"b')}/provider_settings`,
      );
      assert.match(
        yield* assertBoseXml(response),
        /\?><providerSettings><providerSetting><boseId>a&amp;&quot;b<\/boseId><keyName>ELIGIBLE_FOR_TRIAL<\/keyName><value>false<\/value><providerId>14<\/providerId><\/providerSetting><\/providerSettings>$/,
      );
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
        `<?xml version="1.0" encoding="UTF-8" ?><recent><lastplayedat>2026-03-29T21:33:00+00:00</lastplayedat><sourceid>10005</sourceid><name>FIP</name><location>${STATION_LOCATION}</location><contentItemType>stationurl</contentItemType></recent>`,
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
          `<recent id="\\d+"><contentItemType>stationurl</contentItemType><createdOn>${MARGE_DATE}</createdOn><lastplayedat>2026-03-29T21:33:00\\.000\\+00:00</lastplayedat><location>${literal(STATION_LOCATION)}</location><name>FIP</name>${literal(RADIO_BROWSER_SOURCE_XML)}<sourceid>10005</sourceid>`,
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

  it.effect("serves a speaker's recents as an empty list", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `${devicePath("EC1127C25A50")}/recents`,
      );
      assert.match(yield* assertBoseXml(response), /<recents\/>$/);
    }),
  );

  it.effect("acknowledges power on and records the speaker's contact", () =>
    Effect.gen(function* () {
      // Device ids are MAC addresses: lower-case names the same speaker.
      const response = yield* assertRecordsContact(
        "A0B1C2D3E401",
        postPowerOn(
          `<?xml version="1.0" encoding="UTF-8" ?><device-data><device id="a0b1c2d3e401"><serialnumber>55307133203739342000010</serialnumber></device></device-data>`,
        ),
      );
      assert.include(yield* assertBoseXml(response), "<status>OK</status>");
    }),
  );

  it.effect.each(["", "not xml <", "<device-data><device/></device-data>"])(
    "acknowledges power on with the body %j",
    (body) =>
      Effect.gen(function* () {
        const response = yield* postPowerOn(body);
        assert.include(yield* assertBoseXml(response), "<status>OK</status>");
      }),
  );

  it.effect("records the contact of a speaker calling Marge", () =>
    Effect.gen(function* () {
      const response = yield* assertRecordsContact(
        "A0B1C2D3E402",
        HttpClient.get(`${devicePath("A0B1C2D3E402")}/recents`),
      );
      assert.strictEqual(response.status, 200);
    }),
  );

  it.effect.each([
    ["stapp", "A0B1C2D3E403"],
    ["scmudc", "A0B1C2D3E404"],
  ] as const)("acknowledges %s stats and records the contact", ([path, id]) =>
    Effect.gen(function* () {
      const response = yield* assertRecordsContact(
        id,
        HttpClient.execute(
          HttpClientRequest.post(`/v1/${path}/${id}`).pipe(
            HttpClientRequest.bodyText(
              `{"envelope":{"uniqueId":"${id}"},"payload":{"events":[]}}`,
              "text/json; charset=utf-8",
            ),
          ),
        ),
      );
      assert.strictEqual(response.status, 200);
      assert.strictEqual(yield* response.text, "");
    }),
  );

  it.effect.each(["EC1127C25A5", "EC1127C25A50F", "EC1127C25A5G", "dev-1"])(
    "rejects the contact of malformed device id %s",
    (deviceId) =>
      Effect.gen(function* () {
        const response = yield* HttpClient.get(
          `/api/internal/device/${deviceId}/contact`,
        );
        assert.strictEqual(response.status, 400);
      }),
  );

  it.effect("serves a firmware index naming the last firmware", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get("/updates/soundtouch");
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers["content-type"], "application/xml");
      const body = yield* response.text;
      assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<INDEX /);
      assert.match(
        body,
        /<DEVICE ID="0x0939" PRODUCTNAME="SoundTouch 10">\s*<HARDWARE REVISION="00\.01\.00">\s*<RELEASE REVISION="27\.0\.6\.46330\.5043500"/,
      );
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
        assert.match(
          yield* assertBoseXml(response, 201),
          new RegExp(
            `<device deviceid="EC1127C25A50"><createdOn>${MARGE_DATE}</createdOn><name>Bose SoundTouch 10</name><updatedOn>${MARGE_DATE}</updatedOn></device>$`,
          ),
        );
      }),
  );

  it.effect("rejects a device registration without a device id", () =>
    Effect.gen(function* () {
      const response = yield* HttpClient.execute(
        HttpClientRequest.post(`/streaming/account/${ACCOUNT}/device`).pipe(
          HttpClientRequest.bodyText(
            "<device><name>Bose SoundTouch 10</name></device>",
            BOSE_XML_CONTENT_TYPE,
          ),
        ),
      );
      assert.strictEqual(response.status, 400);
    }),
  );

  const putDevice = (deviceId: string, body: string, accountId = ACCOUNT) =>
    HttpClient.execute(
      HttpClientRequest.put(devicePath(deviceId, accountId)).pipe(
        HttpClientRequest.bodyText(body, BOSE_XML_CONTENT_TYPE),
      ),
    );

  it.effect("accepts a speaker's rename and pairs it", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      const response = yield* putDevice(
        "EC1127C25A50",
        `<?xml version="1.0" encoding="UTF-8" ?><device deviceid="EC1127C25A50"><name>Kitchen &amp; Co</name><macaddress>EC1127C25A50</macaddress></device>`,
        accountId,
      );
      assert.match(
        yield* assertBoseXml(response),
        new RegExp(
          `<device deviceid="EC1127C25A50"><createdOn>${MARGE_DATE}</createdOn><name>Kitchen &amp; Co</name><updatedOn>${MARGE_DATE}</updatedOn></device>$`,
        ),
      );
      assert.deepStrictEqual(listedDeviceIds(yield* getFullXml(accountId)), [
        "EC1127C25A50",
      ]);
    }),
  );

  it.effect("rejects a rename for another speaker than the path's", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      const response = yield* putDevice(
        "EC1127C25A50",
        `<device deviceid="EC1127C25A51"><name>Kitchen</name></device>`,
        accountId,
      );
      assert.strictEqual(response.status, 400);
      assert.include(yield* getFullXml(accountId), "<devices/>");
    }),
  );

  it.effect("lists each paired device in the account with its presets", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      assert.include(yield* getFullXml(accountId), "<devices/>");

      const registered = speaker("registered");
      const presetSaver = speaker("preset-saver");
      yield* registerDevice(registered, accountId);
      yield* putPreset(presetSaver, 3, speakerPresetXml({ name: "Saved" }), {
        accountId,
      });
      // Pairing again does not list the device twice.
      yield* registerDevice(registered, accountId);

      const full = yield* getFullXml(accountId);
      assert.sameMembers(listedDeviceIds(full), [registered, presetSaver]);
      // A device without presets has no `<presets>`: an empty one wipes the
      // speaker's own.
      assert.include(full, `<device deviceid="${registered}"></device>`);
      assert.include(
        full,
        `<device deviceid="${presetSaver}"><presets><preset buttonNumber="3">`,
      );
      assert.include(full, "<name>Saved</name>");
    }),
  );

  it.effect("pairs a speaker that looks its group up at boot", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      const booting = speaker("booting");
      const response = yield* HttpClient.get(
        `${devicePath(booting, accountId)}/group/`,
      );
      assert.match(yield* assertBoseXml(response), /<group\/>$/);
      assert.deepStrictEqual(listedDeviceIds(yield* getFullXml(accountId)), [
        booting,
      ]);
    }),
  );

  it.effect("pairs a speaker whose presets the app syncs", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      const synced = speaker("app-synced");
      yield* syncPresets(synced, [], accountId);
      assert.deepStrictEqual(listedDeviceIds(yield* getFullXml(accountId)), [
        synced,
      ]);
    }),
  );

  it.effect(
    "keeps a speaker in its account when another account pairs it",
    () =>
      Effect.gen(function* () {
        const household = yield* mintAccountId;
        const stranger = yield* mintAccountId;
        const victim = speaker("victim");
        yield* registerDevice(victim, household);
        yield* putPreset(victim, 1, speakerPresetXml({ name: "Ours" }), {
          accountId: household,
        });

        // Every call that pairs, made under another account with the
        // speaker's (public) device id.
        yield* registerDevice(victim, stranger);
        yield* HttpClient.get(`${devicePath(victim, stranger)}/group/`);
        yield* syncPresets(victim, [], stranger);
        yield* putPreset(victim, 1, speakerPresetXml({ name: "Taken" }), {
          accountId: stranger,
        });
        yield* HttpClient.execute(
          HttpClientRequest.delete(`${devicePath(victim, stranger)}/preset/1`),
        );

        assert.deepStrictEqual(listedDeviceIds(yield* getFullXml(household)), [
          victim,
        ]);
        assert.include(
          yield* getPresetsXml(victim, household),
          "<name>Ours</name>",
        );
      }),
  );

  it.effect("does not pair a speaker whose preset or recent is malformed", () =>
    Effect.gen(function* () {
      const accountId = yield* mintAccountId;
      const malformed = speaker("malformed");
      const preset = yield* putPreset(malformed, 1, "not xml", { accountId });
      const recent = yield* HttpClient.execute(
        HttpClientRequest.post(
          `${devicePath(malformed, accountId)}/recent`,
        ).pipe(HttpClientRequest.bodyText("not xml", BOSE_XML_CONTENT_TYPE)),
      );
      assert.deepStrictEqual([preset.status, recent.status], [400, 400]);
      assert.include(yield* getFullXml(accountId), "<devices/>");
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
          ["TUNEIN", 25, "https://api.revivest.app/bmx/tunein"],
          ["RADIO_BROWSER", 39, "https://api.revivest.app/bmx/radiobrowser"],
          ["LOCAL_INTERNET_RADIO", 11, "https://api.revivest.app/bmx/orion"],
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
        /^http:\/\/127\.0\.0\.1:\d+\/bmx\/tunein$/,
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
    "/bmx/radiobrowser/token",
    "/bmx/tunein/v1/token",
    "/bmx/orion/token",
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

  it.effect("plays a Radio Browser station from its current stream", () =>
    Effect.gen(function* () {
      const playback = yield* HttpClient.get(
        `/bmx/radiobrowser${STATION_LOCATION}`,
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxPlayback)));
      const stream = {
        hasPlaylist: true,
        isRealtime: true,
        streamUrl: "http://mp3channels.example/chillout",
      };
      assert.deepStrictEqual(playback, {
        audio: { ...stream, streams: [stream] },
        imageUrl: "https://cdn.example/antenne.png",
        name: "Antenne Bayern - Chillout",
        streamType: "liveRadio",
      });
    }),
  );

  it.effect.each([
    ["an unknown station", MISSING_UUID, 404],
    ["Radio Browser being down", UNAVAILABLE_UUID, 503],
    ["a malformed station id", "s166521", 400],
  ] as const)("fails a Radio Browser station for %s", ([, uuid, status]) =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(
        `/bmx/radiobrowser/stations/byuuid/${uuid}`,
      );
      assert.strictEqual(response.status, status);
    }),
  );

  it.effect("plays a custom station from its location alone", () =>
    Effect.gen(function* () {
      const playback = yield* HttpClient.get(
        `/bmx/orion/station?data=${customStationData({
          name: "Hits & Co",
          imageUrl: "https://cdn.example/hits.png",
          streamUrl: "http://stream.example:8000/hits.mp3",
        })}`,
      ).pipe(Effect.flatMap(HttpIncomingMessage.schemaBodyJson(BmxPlayback)));
      const stream = {
        hasPlaylist: true,
        isRealtime: true,
        streamUrl: "http://stream.example:8000/hits.mp3",
      };
      assert.deepStrictEqual(playback, {
        audio: { ...stream, streams: [stream] },
        imageUrl: "https://cdn.example/hits.png",
        name: "Hits & Co",
        streamType: "liveRadio",
      });
    }),
  );

  it.effect.each([
    ["data that isn't base64", "%%%"],
    ["a station without a stream", customStationData({ name: "Silent" })],
    [
      "a stream that isn't http",
      customStationData({ streamUrl: "file:///etc/passwd" }),
    ],
  ] as const)("refuses a custom station with %s", ([, data]) =>
    Effect.gen(function* () {
      const response = yield* HttpClient.get(`/bmx/orion/station?data=${data}`);
      assert.strictEqual(response.status, 400);
    }),
  );

  it.effect("documents every endpoint and its path parameters", () =>
    Effect.gen(function* () {
      const spec = yield* HttpClient.get("/openapi.json").pipe(
        Effect.flatMap(
          HttpIncomingMessage.schemaBodyJson(
            Schema.Struct({
              paths: Schema.Record(
                Schema.String,
                Schema.Record(
                  Schema.String,
                  Schema.Struct({
                    summary: Schema.optional(Schema.String),
                    description: Schema.optional(Schema.String),
                    parameters: Schema.Array(
                      Schema.Struct({
                        name: Schema.String,
                        description: Schema.optional(Schema.String),
                      }),
                    ),
                  }),
                ),
              ),
            }),
          ),
        ),
      );
      const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
        Object.entries(item).map(([method, operation]) => ({
          route: `${method.toUpperCase()} ${path}`,
          ...operation,
        })),
      );
      assert.isNotEmpty(operations);
      for (const { route, summary, description, parameters } of operations) {
        assert.isNotEmpty(summary, route);
        assert.isNotEmpty(description, route);
        for (const parameter of parameters) {
          assert.isNotEmpty(
            parameter.description,
            `${route} ${parameter.name}`,
          );
        }
      }
    }),
  );
});
