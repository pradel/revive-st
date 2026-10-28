import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/http-api";

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
 * The BMX service registry (`bmxRegistryUrl`) and the custom-station adapter
 * it advertises.
 */
export class BmxApi extends HttpApiGroup.make("bmx").add(
  HttpApiEndpoint.get("registry", "/v2/registry.json", {
    success: BmxRegistry,
    error: HttpApiError.BadRequest,
  }),
  HttpApiEndpoint.get(
    "station",
    "/core02/svc-bmx-adapter-orion/prod/orion/station",
    { query: { data: BmxStationData }, success: BmxPlayback },
  ),
) {}
