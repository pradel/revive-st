import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import { ORION_BASE_PATH, TUNEIN_BASE_PATH } from "../api/bmx.ts";
import { TUNEIN } from "../marge/sources.ts";
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

/** Base64 of `{"serial":"orion"}`, the shape Bose's adapters issued. */
const ORION_TOKEN = "eyJzZXJpYWwiOiJvcmlvbiJ9";

export const BmxHandlers = HttpApiBuilder.group(
  ReviveApi,
  "bmx",
  Effect.fn(function* (handlers) {
    const tuneIn = yield* TuneIn;

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
                _links: { bmx_token: { href: "/token" }, self: { href: "/" } },
                askAdapter: false,
                assets: {
                  color: "#000000",
                  description: "Custom radio stations with BMX.",
                  icons,
                  name: "Custom Stations",
                },
                authenticationModel: anonymousAccount,
                baseUrl: `${baseUrl}${ORION_BASE_PATH}`,
                id: { name: "LOCAL_INTERNET_RADIO", value: 11 },
                streamTypes: ["liveRadio"],
              },
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
            ],
          };
        }),
      )
      .handle("station", ({ query: { data } }) =>
        Effect.succeed(
          playback({
            streamUrls: [data.streamUrl],
            name: data.name ?? "Custom Stream",
            imageUrl: data.imageUrl ?? "",
          }),
        ),
      )
      .handle("orionToken", () => Effect.succeed(anonymousToken(ORION_TOKEN)))
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
      .handle("tuneInReport", () => Effect.succeed({}));
  }),
);
