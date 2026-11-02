/**
 * What the server's tests share: stand-ins for the station directories, and
 * the requests the app and speakers make, against the server under test.
 */
import { createHash } from "node:crypto";

import { Effect, Layer, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpIncomingMessage,
} from "effect/http";

import {
  RadioBrowser,
  RadioBrowserStationNotFound,
  RadioBrowserUnavailable,
} from "./radio-browser/radio-browser.ts";
import { StationNotFound, TuneIn, TuneInUnavailable } from "./tunein/tunein.ts";

/** TuneIn as the tests need it: `s1` plays, `s404` is gone, `s503` fails. */
export const TuneInTest = Layer.succeed(
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

export const STATION_UUID = "9610c454-0601-11e8-ae97-52543be04c81";
export const MISSING_UUID = "00000000-0000-0000-0000-000000000404";
export const UNAVAILABLE_UUID = "00000000-0000-0000-0000-000000000503";

/** Radio Browser as the tests need it: one station, one gone, one failing. */
export const RadioBrowserTest = Layer.succeed(
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

/** The account the tests' speakers are paired with. */
export const ACCOUNT = "household-1";

/**
 * A device id as speakers send it, a MAC address, derived from `label` so
 * each test names its own speakers.
 */
export const speaker = (label: string) =>
  createHash("sha256").update(label).digest("hex").slice(0, 12).toUpperCase();

/** The app saving a speaker's presets for its household. */
export const syncPresets = (
  deviceId: string,
  presets: unknown,
  accountId = ACCOUNT,
) =>
  HttpClient.execute(
    HttpClientRequest.post(
      `/api/internal/account/${accountId}/device/${deviceId}/presets`,
    ).pipe(HttpClientRequest.bodyJsonUnsafe({ presets })),
  );

/** The app creating a household account. */
export const mintAccountId = HttpClient.post("/api/internal/accounts").pipe(
  Effect.flatMap(
    HttpIncomingMessage.schemaBodyJson(
      Schema.Struct({ accountId: Schema.String }),
    ),
  ),
  Effect.map(({ accountId }) => accountId),
);

/** The speaker's last contact, as the app reads it. */
export const getLastContactAt = (deviceId: string) =>
  HttpClient.get(`/api/internal/device/${deviceId}/contact`).pipe(
    Effect.flatMap(
      HttpIncomingMessage.schemaBodyJson(
        Schema.Struct({ lastContactAt: Schema.NullOr(Schema.Number) }),
      ),
    ),
    Effect.map(({ lastContactAt }) => lastContactAt),
  );
