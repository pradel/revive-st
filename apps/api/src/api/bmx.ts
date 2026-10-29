import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";

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
});

/** The station the app encodes into a preset's `location` URL. */
export const BmxStation = Schema.Struct({
  streamUrl: Schema.String,
  name: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
});

/** URL-safe base64 of the UTF-8 JSON of a {@link BmxStation}. */
const BmxStationData = Schema.StringFromBase64Url.pipe(
  Schema.decodeTo(Schema.fromJsonString(BmxStation)),
);

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
});

export const ORION_BASE_PATH = "/core02/svc-bmx-adapter-orion/prod/orion";
export const TUNEIN_BASE_PATH = "/bmx/tunein";

/**
 * The BMX service registry (`bmxRegistryUrl`) and the adapters it
 * advertises: custom stations (Orion) and TuneIn.
 */
export class BmxApi extends HttpApiGroup.make("bmx").add(
  HttpApiEndpoint.get("registry", "/v2/registry.json", {
    success: BmxRegistry,
    error: HttpApiError.BadRequest,
  }),
  HttpApiEndpoint.get("station", `${ORION_BASE_PATH}/station`, {
    query: { data: BmxStationData },
    success: BmxPlayback,
  }),
  HttpApiEndpoint.post("orionToken", `${ORION_BASE_PATH}/token`, {
    success: BmxToken,
  }),
  HttpApiEndpoint.get(
    "tuneInStation",
    `${TUNEIN_BASE_PATH}/v1/playback/station/:stationId`,
    {
      params: { stationId: StationId },
      success: BmxPlayback,
      error: [HttpApiError.NotFound, HttpApiError.ServiceUnavailable],
    },
  ),
  HttpApiEndpoint.post("tuneInToken", `${TUNEIN_BASE_PATH}/v1/token`, {
    success: BmxToken,
  }),
  /** Listening reports (START, STOP, …): acknowledged and dropped. */
  HttpApiEndpoint.post("tuneInReport", `${TUNEIN_BASE_PATH}/v1/report`, {
    success: Schema.Struct({}),
  }),
) {}
