import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  OpenApi,
} from "effect/http-api";

import { StationUuid } from "../radio-browser/radio-browser.ts";
import { StationId } from "../tunein/tunein.ts";

const Link = Schema.Struct({ href: Schema.String });

export const BmxRegistry = Schema.Struct({
  _links: Schema.Struct({ bmx_services_availability: Link }),
  askAgainAfter: Schema.Number,
  bmx_services: Schema.Array(
    Schema.Struct({
      _links: Schema.Struct({ bmx_token: Link, self: Link }),
      askAdapter: Schema.Boolean,
      assets: Schema.Struct({
        color: Schema.String,
        description: Schema.String,
        icons: Schema.Struct({
          largeSvg: Schema.String,
          monochromePng: Schema.String,
          monochromeSvg: Schema.String,
          smallSvg: Schema.String,
        }),
        name: Schema.String,
      }),
      authenticationModel: Schema.Struct({
        anonymousAccount: Schema.Struct({
          autoCreate: Schema.Boolean,
          enabled: Schema.Boolean,
        }),
      }),
      baseUrl: Schema.String,
      id: Schema.Struct({ name: Schema.String, value: Schema.Number }),
      streamTypes: Schema.Array(Schema.String),
    }),
  ),
}).annotate({
  description:
    "The adapters the speaker plays stations through, with their icons and base URLs.",
});

const BmxStream = Schema.Struct({
  hasPlaylist: Schema.Boolean,
  isRealtime: Schema.Boolean,
  streamUrl: Schema.String,
});

export const BmxPlayback = Schema.Struct({
  audio: Schema.Struct({
    ...BmxStream.fields,
    streams: Schema.Array(BmxStream),
  }),
  imageUrl: Schema.String,
  name: Schema.String,
  streamType: Schema.Literal("liveRadio"),
}).annotate({
  description:
    "The station's name, logo and streams. `audio` repeats the first stream.",
});

/**
 * The anonymous account a BMX adapter hands out. Speakers send the access
 * token back with playback requests and refuse a source whose tokens are
 * empty.
 */
export const BmxToken = Schema.Struct({
  _embedded: Schema.Struct({
    bmx_account: Schema.Struct({
      displayName: Schema.String,
      username: Schema.String,
    }),
  }),
  access_token: Schema.String,
  refresh_token: Schema.String,
}).annotate({
  description:
    "The anonymous account: both tokens are the source's Marge credential.",
});

export const TUNEIN_BASE_PATH = "/bmx/tunein";
export const RADIO_BROWSER_BASE_PATH = "/bmx/radiobrowser";
export const CUSTOM_STATIONS_BASE_PATH = "/bmx/orion";

/**
 * A custom station as its location carries it: base64 of a JSON object, the
 * format other SoundTouch servers use for `LOCAL_INTERNET_RADIO`.
 */
export const CustomStationData = Schema.StringFromBase64.pipe(
  Schema.decodeTo(
    Schema.fromJsonString(
      Schema.Struct({
        streamUrl: Schema.String.check(Schema.isPattern(/^https?:\/\/\S+$/i)),
        name: Schema.optional(Schema.String),
        imageUrl: Schema.optional(Schema.String),
      }),
    ),
  ),
);

/**
 * The BMX service registry (`bmxRegistryUrl`) and the adapters it
 * advertises: TuneIn, Radio Browser and custom stations.
 */
export class BmxApi extends HttpApiGroup.make("bmx")
  .add(
    HttpApiEndpoint.get("registry", "/v2/registry.json", {
      success: BmxRegistry,
      error: HttpApiError.BadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Get the BMX service registry",
        description:
          "The registry at the speaker's `bmxRegistryUrl`. It points the speaker at three adapters on this server, TuneIn, Radio Browser and custom stations, with URLs built from the host and protocol the speaker called.",
      }),
    ),
    HttpApiEndpoint.get(
      "tuneInStation",
      `${TUNEIN_BASE_PATH}/v1/playback/station/:stationId`,
      {
        params: { stationId: StationId },
        success: BmxPlayback,
        error: [HttpApiError.NotFound, HttpApiError.ServiceUnavailable],
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Play a TuneIn station",
        description:
          "Resolves a TuneIn station to its streams through TuneIn's public OPML API. HLS streams are never requested, as speakers can't play them. `404` for a station TuneIn has no stream for, `503` when TuneIn is unavailable.",
      }),
    ),
    HttpApiEndpoint.post("tuneInToken", `${TUNEIN_BASE_PATH}/v1/token`, {
      success: BmxToken,
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Get a TuneIn token",
        description:
          "An anonymous account token. Speakers refuse a source whose token is empty.",
      }),
    ),
    HttpApiEndpoint.post("tuneInReport", `${TUNEIN_BASE_PATH}/v1/report`, {
      success: Schema.Struct({}).annotate({ description: "An empty object." }),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Report TuneIn listening",
        description:
          "Listening reports (`START`, `STOP`, …): acknowledged and dropped.",
      }),
    ),
    HttpApiEndpoint.get(
      "radioBrowserStation",
      `${RADIO_BROWSER_BASE_PATH}/stations/byuuid/:stationUuid`,
      {
        params: { stationUuid: StationUuid },
        success: BmxPlayback,
        error: [HttpApiError.NotFound, HttpApiError.ServiceUnavailable],
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Play a Radio Browser station",
        description: [
          "Looks the station up through Radio Browser's API and returns its current stream (`url_resolved`, else `url`), name and logo. A failed lookup is tried once more.",
          "A Radio Browser preset's `location` is `/stations/byuuid/<uuid>`, the same path as Radio Browser's own SoundTouch API, so the registry can point at either without touching presets.",
          "`404` for a station Radio Browser doesn't know or that only has an HLS stream, which speakers can't play; `503` when Radio Browser is unavailable.",
        ].join("\n\n"),
      }),
    ),
    HttpApiEndpoint.post(
      "radioBrowserToken",
      `${RADIO_BROWSER_BASE_PATH}/token`,
      { success: BmxToken },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Get a Radio Browser token",
        description:
          "An anonymous account token. Speakers refuse a source whose token is empty.",
      }),
    ),
    HttpApiEndpoint.get(
      "customStation",
      `${CUSTOM_STATIONS_BASE_PATH}/station`,
      {
        query: { data: CustomStationData },
        success: BmxPlayback,
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Play a custom station",
        description: [
          "Plays a stream added by URL (`LOCAL_INTERNET_RADIO`). The station's location, `/station?data=<base64 JSON>`, carries the stream URL, name and logo, so this answers from it alone without calling anything.",
          "The app opens playlists and refuses HLS streams before saving a station, so the stream URL is played as given. `400` when `data` isn't such a station.",
        ].join("\n\n"),
      }),
    ),
    HttpApiEndpoint.post(
      "customStationsToken",
      `${CUSTOM_STATIONS_BASE_PATH}/token`,
      { success: BmxToken },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Get a custom stations token",
        description:
          "An anonymous account token. Speakers refuse a source whose token is empty.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "BMX",
      description:
        "The BMX service registry and the TuneIn, Radio Browser and custom stations adapters it advertises, which speakers play stations through.",
    }),
  ) {}
