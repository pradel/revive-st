import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { DeviceId } from "../presets/preset.ts";

/**
 * The firmware update index speakers fetch from their `swUpdateUrl`, once it
 * points at this server.
 */
export class UpdatesApi extends HttpApiGroup.make("updates")
  .add(
    HttpApiEndpoint.get("softwareUpdateIndex", "/updates/soundtouch", {
      success: Schema.String.annotate({
        description:
          "`<INDEX>`: each SoundTouch model's latest firmware release, `27.0.6`.",
      }).pipe(HttpApiSchema.asText({ contentType: "application/xml" })),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Get the firmware update index",
        description:
          "Called by the speaker to check for firmware updates. Lists every SoundTouch model at the last firmware Bose released, so a speaker running it never updates.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Software updates",
      description:
        "What SoundTouch speakers call once their `swUpdateUrl` is `/updates/soundtouch` on this server.",
    }),
  ) {}

const STATS_DESCRIPTION =
  "Called by the speaker to report usage events. Stats are acknowledged, not stored: the body is discarded whatever its content type, and the reply is an empty `200`. Records the speaker's contact.";

/** The usage stats speakers post to their `statsServerUrl`. */
export class StatsApi extends HttpApiGroup.make("stats")
  .add(
    HttpApiEndpoint.post("appStats", "/v1/stapp/:deviceId", {
      params: { deviceId: DeviceId },
      success: HttpApiSchema.Empty(200),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Report app events",
        description: STATS_DESCRIPTION,
      }),
    ),
    HttpApiEndpoint.post("deviceStats", "/v1/scmudc/:deviceId", {
      params: { deviceId: DeviceId },
      success: HttpApiSchema.Empty(200),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Report usage events",
        description: STATS_DESCRIPTION,
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Stats",
      description:
        "What SoundTouch speakers call once their `statsServerUrl` points at this server.",
    }),
  ) {}
