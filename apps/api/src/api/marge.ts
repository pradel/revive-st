import { escapeXml, parseXml } from "bose-api-speaker-client";
import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/http-api";

import { AccountId } from "../marge/account.ts";
import { DeviceId, PresetId } from "../presets/preset.ts";

export const BOSE_XML_CONTENT_TYPE = "application/vnd.bose.streaming-v1.2+xml";

const BoseXml = Schema.String.pipe(
  HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
);

const BoseXmlWithEtag = HttpApiSchema.WithHeaders(BoseXml, {
  ETag: Schema.String,
});

/**
 * A flat XML document a speaker sends, decoded to the text of its root's
 * children, keyed by element name. Elements the speaker leaves out or sends
 * empty are absent.
 */
const speakerXml = <const Fields extends Schema.Struct.Fields>(
  rootName: string,
  fields: Fields,
) =>
  Schema.String.pipe(
    Schema.decodeTo(
      Schema.Struct(fields),
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
            Effect.map(
              (root) =>
                Object.fromEntries(
                  root.children
                    .filter((child) => child.text !== "")
                    .map((child) => [child.name, child.text]),
                ) as Schema.Struct.Encoded<Fields>,
            ),
          ),
        encode: (value) =>
          Effect.succeed(
            `<${rootName}>${Object.entries(value)
              .map(
                ([name, text]) =>
                  `<${name}>${escapeXml(String(text))}</${name}>`,
              )
              .join("")}</${rootName}>`,
          ),
      }),
    ),
  );

const OptionalText = Schema.optional(Schema.String);

/** The `<preset>` document a speaker PUTs when a preset button is held. */
export const SpeakerPresetXml = speakerXml("preset", {
  sourceid: OptionalText,
  name: OptionalText,
  username: OptionalText,
  location: OptionalText,
  contentItemType: OptionalText,
  containerArt: OptionalText,
});

/** The `<recent>` document a speaker POSTs when it starts playing. */
export const SpeakerRecentXml = speakerXml("recent", {
  sourceid: OptionalText,
  name: OptionalText,
  location: OptionalText,
  contentItemType: OptionalText,
  lastplayedat: OptionalText,
});

/** The `<device deviceid="…">` document a speaker POSTs when it pairs. */
export const SpeakerDeviceXml = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Struct({ deviceId: DeviceId, name: Schema.String }),
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
          Effect.flatMap((root) => {
            const deviceId = root.attributes.deviceid;
            return deviceId === undefined || deviceId === ""
              ? Effect.fail(
                  new SchemaIssue.InvalidValue(
                    { message: "Missing deviceid" },
                    xml,
                    options,
                  ),
                )
              : Effect.succeed({
                  deviceId,
                  name:
                    root.children.find((child) => child.name === "name")
                      ?.text ?? "",
                });
          }),
        ),
      encode: ({ deviceId, name }) =>
        Effect.succeed(
          `<device deviceid="${escapeXml(deviceId)}"><name>${escapeXml(name)}</name></device>`,
        ),
    }),
  ),
);

const AccountParams = { accountId: AccountId };
const DeviceParams = { accountId: AccountId, deviceId: DeviceId };

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
      success: BoseXmlWithEtag,
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
    /** Called by the speaker when a preset is removed from it. */
    HttpApiEndpoint.delete(
      "removePreset",
      "/account/:accountId/device/:deviceId/preset/:presetId",
      {
        params: { ...DeviceParams, presetId: PresetId },
        success: BoseXml,
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
        payload: SpeakerRecentXml.pipe(
          HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
        ),
        success: BoseXml.pipe(HttpApiSchema.status(201)),
        error: HttpApiError.BadRequest,
      },
    ),
    HttpApiEndpoint.post("powerOn", "/support/power_on", {
      success: BoseXml,
    }),
    HttpApiEndpoint.post("registerDevice", "/account/:accountId/device", {
      params: AccountParams,
      payload: SpeakerDeviceXml.pipe(
        HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
      ),
      success: BoseXml.pipe(HttpApiSchema.status(201)),
      error: HttpApiError.BadRequest,
    }),
    /** The speaker's stereo pair group; speakers look it up at boot. */
    HttpApiEndpoint.get(
      "deviceGroup",
      "/account/:accountId/device/:deviceId/group",
      { params: DeviceParams, success: BoseXml },
    ),
  )
  .prefix("/streaming") {}
