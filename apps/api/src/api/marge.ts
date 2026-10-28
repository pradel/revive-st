import { escapeXml, parseXml } from "bose-api-speaker-client";
import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

import { DeviceId, PresetId } from "../presets/preset.ts";

export const BOSE_XML_CONTENT_TYPE = "application/vnd.bose.streaming-v1.2+xml";

const BoseXml = Schema.String.pipe(
  HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
);

const BoseXmlWithEtag = HttpApiSchema.WithHeaders(BoseXml, {
  ETag: Schema.String,
});

/** The fields the server keeps from the `<preset>` document a speaker PUTs. */
export const SpeakerPresetXml = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Struct({ name: Schema.String, location: Schema.String }),
    SchemaTransformation.transformEffect({
      decode: (xml, options) =>
        Effect.try({
          try: () => parseXml(xml),
          catch: () =>
            new SchemaIssue.InvalidValue(
              { message: "Invalid XML payload" },
              xml,
              options,
            ),
        }).pipe(
          Effect.map((root) => {
            const childText = (name: string) =>
              root.children.find((child) => child.name === name)?.text;
            return {
              name: childText("name") ?? "Unknown Preset",
              location: childText("location") ?? "",
            };
          }),
        ),
      encode: ({ name, location }) =>
        Effect.succeed(
          `<preset><name>${escapeXml(name)}</name><location>${escapeXml(location)}</location></preset>`,
        ),
    }),
  ),
);

const AccountParams = { accountId: Schema.String };
const DeviceParams = { accountId: Schema.String, deviceId: DeviceId };

/**
 * The subset of Bose's Marge streaming server that SoundTouch speakers call
 * once `margeServerUrl` points at this API.
 */
export class MargeApi extends HttpApiGroup.make("marge")
  .add(
    HttpApiEndpoint.get("sourceProviders", "/sourceproviders", {
      success: BoseXmlWithEtag,
    }),
    HttpApiEndpoint.get("account", "/account/:accountId/full", {
      params: AccountParams,
      success: BoseXml,
    }),
    HttpApiEndpoint.get(
      "presets",
      "/account/:accountId/device/:deviceId/presets",
      { params: DeviceParams, success: BoseXmlWithEtag },
    ),
    HttpApiEndpoint.put(
      "savePreset",
      "/account/:accountId/device/:deviceId/preset/:presetId",
      {
        params: { ...DeviceParams, presetId: PresetId },
        payload: SpeakerPresetXml.pipe(
          HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
        ),
        success: BoseXml,
        error: HttpApiError.BadRequest,
      },
    ),
    HttpApiEndpoint.get(
      "softwareUpdate",
      "/software/update/account/:accountId",
      { params: AccountParams, success: BoseXml },
    ),
    HttpApiEndpoint.post(
      "addRecent",
      "/account/:accountId/device/:deviceId/recent",
      {
        params: DeviceParams,
        success: HttpApiSchema.WithHeaders(
          BoseXml.pipe(HttpApiSchema.status(201)),
          { Location: Schema.String },
        ),
      },
    ),
    HttpApiEndpoint.post("powerOn", "/support/power_on", {
      success: BoseXml,
    }),
    HttpApiEndpoint.post("registerDevice", "/account/:accountId/device", {
      params: AccountParams,
      success: BoseXml,
    }),
  )
  .prefix("/streaming") {}
