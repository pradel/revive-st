import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";

export const BmxHandlers = HttpApiBuilder.group(ReviveApi, "bmx", (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        "registry",
        Effect.fn(function* ({ request }) {
          // Host and protocol as the speaker sees them, so the asset and
          // adapter URLs below resolve back to this server.
          const url = yield* Effect.fromOption(
            HttpServerRequest.toURL(request),
          ).pipe(Effect.mapError(() => new HttpApiError.BadRequest()));
          const baseUrl = url.origin;
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
                  icons: {
                    largeSvg: `${baseUrl}/media/orion-monochrome.svg`,
                    monochromePng: `${baseUrl}/media/orion-monochrome_v2.png`,
                    monochromeSvg: `${baseUrl}/media/orion-monochrome.svg`,
                    smallSvg: `${baseUrl}/media/orion-monochrome.svg`,
                  },
                  name: "Custom Stations",
                },
                authenticationModel: {
                  anonymousAccount: { autoCreate: true, enabled: true },
                },
                baseUrl: `${baseUrl}/core02/svc-bmx-adapter-orion/prod/orion`,
                id: { name: "LOCAL_INTERNET_RADIO", value: 11 },
                streamTypes: ["liveRadio"],
              },
            ],
          };
        }),
      )
      .handle("station", ({ query: { data } }) => {
        const stream = {
          hasPlaylist: true,
          isRealtime: true,
          streamUrl: data.streamUrl,
        };
        return Effect.succeed({
          audio: { ...stream, streams: [stream] },
          imageUrl: data.imageUrl ?? "",
          name: data.name ?? "Custom Stream",
          streamType: "liveRadio" as const,
        });
      }),
  ),
);
