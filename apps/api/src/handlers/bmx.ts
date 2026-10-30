import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { RADIO_BROWSER_BASE_PATH, TUNEIN_BASE_PATH } from "../api/bmx.ts";
import { RADIO_BROWSER, TUNEIN } from "../marge/sources.ts";
import { RadioBrowser } from "../radio-browser/radio-browser.ts";
import { TuneIn } from "../tunein/tunein.ts";

const playback = (station: {
  readonly streamUrls: readonly string[];
  readonly name: string;
  readonly imageUrl: string;
}) => {
  const streams = station.streamUrls.map((streamUrl) => ({
    hasPlaylist: true,
    isRealtime: true,
    streamUrl,
  }));
  return {
    audio: { ...streams[0], streams },
    imageUrl: station.imageUrl,
    name: station.name,
    streamType: "liveRadio" as const,
  };
};

/** An anonymous account whose token is the source's Marge credential. */
const anonymousToken = (token: string) => ({
  _embedded: { bmx_account: { displayName: "", username: "" } },
  access_token: token,
  refresh_token: token,
});

export const BmxHandlers = HttpApiBuilder.group(
  ReviveApi,
  "bmx",
  Effect.fn(function* (handlers) {
    const tuneIn = yield* TuneIn;
    const radioBrowser = yield* RadioBrowser;

    return handlers
      .handle(
        "registry",
        Effect.fn(function* ({ request }) {
          // Host and protocol as the speaker sees them, so the asset and
          // adapter URLs below resolve back to this server.
          const url = yield* Effect.fromOption(
            HttpServerRequest.toURL(request),
          ).pipe(Effect.mapError(() => new HttpApiError.BadRequest()));
          const baseUrl = url.origin;
          const icons = {
            largeSvg: `${baseUrl}/media/orion-monochrome.svg`,
            monochromePng: `${baseUrl}/media/orion-monochrome_v2.png`,
            monochromeSvg: `${baseUrl}/media/orion-monochrome.svg`,
            smallSvg: `${baseUrl}/media/orion-monochrome.svg`,
          };
          const anonymousAccount = {
            anonymousAccount: { autoCreate: true, enabled: true },
          };
          return {
            _links: {
              bmx_services_availability: { href: "../servicesAvailability" },
            },
            askAgainAfter: 1230482,
            bmx_services: [
              {
                _links: {
                  bmx_token: { href: "/v1/token" },
                  self: { href: "/" },
                },
                askAdapter: false,
                assets: {
                  color: "#000000",
                  description: "Radio stations from TuneIn.",
                  icons,
                  name: "TuneIn",
                },
                authenticationModel: anonymousAccount,
                baseUrl: `${baseUrl}${TUNEIN_BASE_PATH}`,
                id: { name: "TUNEIN", value: TUNEIN.providerId },
                streamTypes: ["liveRadio", "onDemand"],
              },
              {
                _links: { bmx_token: { href: "/token" }, self: { href: "/" } },
                askAdapter: false,
                assets: {
                  color: "#000000",
                  description: "Radio stations from Radio Browser.",
                  icons,
                  name: "Radio Browser",
                },
                authenticationModel: anonymousAccount,
                baseUrl: `${baseUrl}${RADIO_BROWSER_BASE_PATH}`,
                id: { name: "RADIO_BROWSER", value: RADIO_BROWSER.providerId },
                streamTypes: ["liveRadio"],
              },
            ],
          };
        }),
      )
      .handle("tuneInStation", ({ params }) =>
        tuneIn.station(params.stationId).pipe(
          Effect.map(playback),
          Effect.catchTags({
            StationNotFound: () => Effect.fail(new HttpApiError.NotFound()),
            TuneInUnavailable: (error) =>
              Effect.logWarning("TuneIn is unavailable", error.reason).pipe(
                Effect.andThen(
                  Effect.fail(new HttpApiError.ServiceUnavailable()),
                ),
              ),
          }),
        ),
      )
      .handle("tuneInToken", () =>
        Effect.succeed(anonymousToken(TUNEIN.credential)),
      )
      .handle("tuneInReport", () => Effect.succeed({}))
      .handle("radioBrowserStation", ({ params }) =>
        radioBrowser.station(params.stationUuid).pipe(
          Effect.map(playback),
          Effect.catchTags({
            RadioBrowserStationNotFound: () =>
              Effect.fail(new HttpApiError.NotFound()),
            RadioBrowserUnavailable: (error) =>
              Effect.logWarning(
                "Radio Browser is unavailable",
                error.reason,
              ).pipe(
                Effect.andThen(
                  Effect.fail(new HttpApiError.ServiceUnavailable()),
                ),
              ),
          }),
        ),
      )
      .handle("radioBrowserToken", () =>
        Effect.succeed(anonymousToken(RADIO_BROWSER.credential)),
      );
  }),
);
