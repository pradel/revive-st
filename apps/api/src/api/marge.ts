import { escapeXml, parseXml } from "bose-api-speaker-client";
import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { GroupId, GroupName } from "../devices/groups-repo.ts";
import { AccountId } from "../marge/account.ts";
import { PresetId, PresetText, SpeakerDeviceId } from "../presets/preset.ts";

export const BOSE_XML_CONTENT_TYPE = "application/vnd.bose.streaming-v1.2+xml";

/** A Bose XML document; `description` says what it holds. */
const boseXml = (description: string) =>
  Schema.String.annotate({ description }).pipe(
    HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
  );

/** A Bose XML document with an `ETag` a speaker polls it with. */
const boseXmlWithEtag = (description: string) =>
  HttpApiSchema.WithHeaders(boseXml(description), {
    ETag: Schema.String.annotate({
      description:
        "Derived from the body. A GET whose `If-None-Match` matches it gets a bare `304 Not Modified`.",
    }),
  });

/** The XML a speaker sends, documented with an example. */
const SpeakerXmlText = (doc: { description: string; example: string }) =>
  Schema.String.annotate({
    description: doc.description,
    examples: [doc.example],
  });

/**
 * A flat XML document a speaker sends, decoded to the text of its root's
 * children, keyed by element name. Elements the speaker leaves out or sends
 * empty are absent.
 */
const speakerXml = <const Fields extends Schema.Struct.Fields>(
  rootName: string,
  fields: Fields,
  doc: { description: string; example: string },
) =>
  SpeakerXmlText(doc).pipe(
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
export const SpeakerPresetXml = speakerXml(
  "preset",
  {
    sourceid: Schema.optional(PresetText.source),
    name: Schema.optional(PresetText.itemName),
    username: Schema.optional(PresetText.itemName),
    location: Schema.optional(PresetText.location),
    contentItemType: Schema.optional(PresetText.type),
    containerArt: Schema.optional(PresetText.containerArt),
  },
  {
    description:
      "The preset the speaker stored. `sourceid` is a source id from the account's `/full` document, or `TUNEIN`.",
    example:
      '<?xml version="1.0" encoding="UTF-8" ?><preset buttonNumber="1"><sourceid>10005</sourceid><name>FIP</name><username>FIP</username><location>/stations/byuuid/9610c454-0601-11e8-ae97-52543be04c81</location><contentItemType>stationurl</contentItemType><containerArt>https://cdn.example/fip.png</containerArt></preset>',
  },
);

/** The `<recent>` document a speaker POSTs when it starts playing. */
export const SpeakerRecentXml = speakerXml(
  "recent",
  {
    sourceid: OptionalText,
    name: OptionalText,
    location: OptionalText,
    contentItemType: OptionalText,
    lastplayedat: OptionalText,
  },
  {
    description: "What the speaker started playing.",
    example:
      '<?xml version="1.0" encoding="UTF-8" ?><recent><lastplayedat>2026-03-29T21:33:00+00:00</lastplayedat><sourceid>10005</sourceid><name>FIP</name><location>/stations/byuuid/9610c454-0601-11e8-ae97-52543be04c81</location><contentItemType>stationurl</contentItemType></recent>',
  },
);

/** The `<device deviceid="…">` document a speaker POSTs when it pairs. */
export const SpeakerDeviceXml = SpeakerXmlText({
  description: "The speaker being paired: its device id and name.",
  example:
    '<?xml version="1.0" encoding="UTF-8" ?><device deviceid="EC1127C25A50"><name>Kitchen</name><macaddress>EC1127C25A50</macaddress></device>',
}).pipe(
  Schema.decodeTo(
    Schema.Struct({ deviceId: SpeakerDeviceId, name: Schema.String }),
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

/** The `<group>` document the master speaker POSTs to create a pair. */
export const SpeakerGroupXml = SpeakerXmlText({
  description:
    "The new stereo pair: its name, master and the LEFT and RIGHT speakers.",
  example:
    '<?xml version="1.0" encoding="UTF-8" ?><group><masterDeviceId>0CAE7D6298E9</masterDeviceId><name>Living room + Office</name><roles><groupRole><deviceId>0CAE7D6298E9</deviceId><role>LEFT</role></groupRole><groupRole><deviceId>EC1127C25A50</deviceId><role>RIGHT</role></groupRole></roles></group>',
}).pipe(
  Schema.decodeTo(
    Schema.Struct({
      name: GroupName,
      masterDeviceId: SpeakerDeviceId,
      leftDeviceId: SpeakerDeviceId,
      rightDeviceId: SpeakerDeviceId,
    }),
    SchemaTransformation.transformEffect({
      decode: (xml, options) => {
        const invalid = (message: string) =>
          new SchemaIssue.InvalidValue({ message }, xml, options);
        return Effect.try({
          try: () => parseXml(xml),
          catch: () => invalid("Invalid XML payload"),
        }).pipe(
          Effect.flatMap((root) => {
            const text = (name: string) =>
              root.children.find((child) => child.name === name)?.text;
            const roles = (
              root.children.find((child) => child.name === "roles")?.children ??
              []
            ).map((groupRole) => ({
              deviceId: groupRole.children.find(
                (child) => child.name === "deviceId",
              )?.text,
              role: groupRole.children.find((child) => child.name === "role")
                ?.text,
            }));
            const left = roles.find(({ role }) => role === "LEFT")?.deviceId;
            const right = roles.find(({ role }) => role === "RIGHT")?.deviceId;
            const masterDeviceId = text("masterDeviceId");
            if (
              roles.length !== 2 ||
              left === undefined ||
              right === undefined ||
              left.toUpperCase() === right.toUpperCase()
            ) {
              return Effect.fail(
                invalid("Expected a LEFT and a RIGHT role on two speakers"),
              );
            }
            const master = masterDeviceId?.toUpperCase();
            if (
              masterDeviceId === undefined ||
              (master !== left.toUpperCase() && master !== right.toUpperCase())
            ) {
              return Effect.fail(invalid("The master is in neither role"));
            }
            return Effect.succeed({
              name: text("name") ?? "",
              masterDeviceId,
              leftDeviceId: left,
              rightDeviceId: right,
            });
          }),
        );
      },
      encode: (group) =>
        Effect.succeed(
          [
            "<group>",
            `<masterDeviceId>${escapeXml(group.masterDeviceId)}</masterDeviceId>`,
            `<name>${escapeXml(group.name)}</name>`,
            "<roles>",
            `<groupRole><deviceId>${escapeXml(group.leftDeviceId)}</deviceId><role>LEFT</role></groupRole>`,
            `<groupRole><deviceId>${escapeXml(group.rightDeviceId)}</deviceId><role>RIGHT</role></groupRole>`,
            "</roles></group>",
          ].join(""),
        ),
    }),
  ),
);

/**
 * The `<group>` document a speaker PUTs to its pair: its own id as
 * `masterDeviceId`, whichever speaker it is, and the pair's name.
 */
export const SpeakerGroupNameXml = speakerXml(
  "group",
  { masterDeviceId: OptionalText, name: GroupName },
  {
    description:
      "The pair's name, and the id of the speaker sending it as `masterDeviceId`.",
    example:
      '<?xml version="1.0" encoding="UTF-8" ?><group><masterDeviceId>EC1127C25A50</masterDeviceId><name>Living room + Office</name></group>',
  },
);

const AccountParams = { accountId: AccountId };
const GroupParams = { accountId: AccountId, groupId: GroupId };
const DeviceParams = { accountId: AccountId, deviceId: SpeakerDeviceId };

/**
 * The subset of Bose's Marge streaming server that SoundTouch speakers call
 * once `margeServerUrl` points at this API.
 */
export class MargeApi extends HttpApiGroup.make("marge")
  .add(
    HttpApiEndpoint.get("sourceProviders", "/sourceproviders", {
      success: boseXmlWithEtag(
        "`<sourceProviders>`: `TUNEIN` (id `25`), `RADIO_BROWSER` (id `39`) and `LOCAL_INTERNET_RADIO` (id `11`).",
      ),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "List source providers",
        description:
          "The source providers the speaker resolves source provider ids against.",
      }),
    ),
    HttpApiEndpoint.get("account", "/account/:accountId/full", {
      params: AccountParams,
      success: boseXmlWithEtag(
        "`<account>`: the account's sources and paired speakers with their presets.",
      ),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Get the full account",
        description: [
          "Fetched by the speaker at boot. It copies `<sources>` into its own source list and only plays and saves presets for sources listed there: `TUNEIN` (id `10004`), `RADIO_BROWSER` (id `10005`) and `LOCAL_INTERNET_RADIO` (id `10006`, custom stations).",
          "`<devices>` lists every speaker paired with the account, each with its presets. A speaker missing from it drops its account and presets at boot; a speaker with no presets restores them from here. A speaker with no stored presets has no `<presets>` element, as an empty one wipes the speaker's presets.",
        ].join("\n\n"),
      }),
    ),
    HttpApiEndpoint.get(
      "presets",
      "/account/:accountId/device/:deviceId/presets",
      {
        params: DeviceParams,
        success: boseXmlWithEtag(
          '`<presets>`: one `<preset buttonNumber="n">` per stored preset, with the `<source>` it plays from.',
        ),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Get a speaker's presets",
        description: "The presets stored for the speaker, in Marge's format.",
      }),
    ),
    HttpApiEndpoint.put(
      "savePreset",
      "/account/:accountId/device/:deviceId/preset/:presetId",
      {
        params: { ...DeviceParams, presetId: PresetId },
        payload: SpeakerPresetXml.pipe(
          HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
        ),
        success: boseXml("`<preset>`: the stored preset."),
        error: HttpApiError.BadRequest,
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Save a preset",
        description:
          "Called by the speaker when a preset button is held. Pairs the speaker with the account. A preset from a source the account doesn't offer, a body that isn't a `<preset>` document, or a field over its maximum length (`name` 512 characters, `location` 4096, `containerArt` 2048) gets `400`. The body is read as XML whatever its content type.",
      }),
    ),
    HttpApiEndpoint.delete(
      "removePreset",
      "/account/:accountId/device/:deviceId/preset/:presetId",
      {
        params: { ...DeviceParams, presetId: PresetId },
        success: boseXml("`<status>OK</status>`."),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Remove a preset",
        description:
          "Called by the speaker when a preset is removed from it. Deletes the stored preset, so the speaker doesn't restore it at its next boot, and pairs the speaker with the account.",
      }),
    ),
    HttpApiEndpoint.get(
      "softwareUpdate",
      "/software/update/account/:accountId",
      {
        params: AccountParams,
        success: boseXml(
          "`<software_update>` with an empty `<softwareUpdateLocation>`.",
        ),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Check for a firmware update",
        description:
          "Called by the speaker to check for firmware updates. There never is one; answering keeps the speaker out of an update failure state.",
      }),
    ),
    HttpApiEndpoint.post(
      "addRecent",
      "/account/:accountId/device/:deviceId/recent",
      {
        params: DeviceParams,
        payload: SpeakerRecentXml.pipe(
          HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
        ),
        success: boseXml(
          "`<recent>`: the recent and the `<source>` it played from.",
        ).pipe(HttpApiSchema.status(201)),
        error: HttpApiError.BadRequest,
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Add a recent",
        description:
          "Called by the speaker when it starts playing something. Pairs the speaker with the account; recents are acknowledged, not stored. A recent from a source the account doesn't offer, or a body that isn't a `<recent>` document, gets `400`.",
      }),
    ),
    HttpApiEndpoint.get(
      "recents",
      "/account/:accountId/device/:deviceId/recents",
      { params: DeviceParams, success: boseXml("An empty `<recents/>`.") },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Get a speaker's recents",
        description:
          "Called by the speaker to read its recents back. Recents aren't stored, so the list is always empty.",
      }),
    ),
    HttpApiEndpoint.post("powerOn", "/support/power_on", {
      success: boseXml("`<status>OK</status>`."),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Report power on",
        description:
          "Called by the speaker when it boots. Records the contact of the speaker named by the body's `<device-data><device id>`; the reply completes the handshake, whatever the body.",
      }),
    ),
    HttpApiEndpoint.post("registerDevice", "/account/:accountId/device", {
      params: AccountParams,
      payload: SpeakerDeviceXml.pipe(
        HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
      ),
      success: boseXml("`<device>`: the paired speaker.").pipe(
        HttpApiSchema.status(201),
      ),
      error: HttpApiError.BadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Pair a speaker",
        description:
          "Called by the speaker when it is paired with an account (`setMargeAccount`). The path also matches with a trailing slash, which is how speakers call it. A bare `200` would make the speaker refuse the pairing with `SET_MARGE_ACCOUNT_ERROR`. A body without a `deviceid`, or with one that isn't 12 hex digits, gets `400`.",
      }),
    ),
    HttpApiEndpoint.put(
      "updateDevice",
      "/account/:accountId/device/:deviceId",
      {
        params: DeviceParams,
        payload: SpeakerDeviceXml.pipe(
          HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
        ),
        success: boseXml("`<device>`: the speaker with its new name."),
        error: HttpApiError.BadRequest,
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Rename a speaker",
        description:
          "Called by the speaker when it is renamed (`POST /name` on the speaker), with the same `<device>` document as pairing. Without a `2xx` reply the speaker keeps its old name. Names aren't stored: the reply echoes the new one. Pairs the speaker with the account. A body without a `deviceid`, or with another speaker's, gets `400`.",
      }),
    ),
    HttpApiEndpoint.get(
      "deviceGroup",
      "/account/:accountId/device/:deviceId/group",
      {
        params: DeviceParams,
        success: boseXml(
          '`<group id="…">` with the stereo pair holding the speaker, or an empty `<group/>`.',
        ),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Get a speaker's group",
        description:
          "Called by the speaker at boot to look up its stereo pair. Returns the account's pair holding the speaker (its id, `name`, `masterDeviceId` and LEFT and RIGHT `roles`), or an empty `<group/>`. The answer is authoritative: speakers told `<group/>` drop their pair. Pairs the speaker with the account.",
      }),
    ),
    HttpApiEndpoint.post("createGroup", "/account/:accountId/group", {
      params: AccountParams,
      payload: SpeakerGroupXml.pipe(
        HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
      ),
      success: HttpApiSchema.WithHeaders(
        boseXml('`<group id="…">`: the stored stereo pair.'),
        {
          Location: Schema.String.annotate({
            description: "The URL of the stored pair.",
          }),
        },
      ).pipe(HttpApiSchema.status(201)),
      error: HttpApiError.BadRequest,
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Create a stereo pair",
        description:
          "Called by the master speaker of a new stereo pair (`addGroup` on the speaker), which adopts the returned 7-digit id. Replaces the account's pairs holding either speaker, and pairs both speakers with the account. A body without a `masterDeviceId`, without exactly one LEFT and one RIGHT role on two different speakers, with a master that is neither, or with a `name` over 512 characters gets `400`.",
      }),
    ),
    HttpApiEndpoint.put("updateGroup", "/account/:accountId/group/:groupId", {
      params: GroupParams,
      payload: SpeakerGroupNameXml.pipe(
        HttpApiSchema.asText({ contentType: BOSE_XML_CONTENT_TYPE }),
      ),
      success: boseXml('`<group id="…">`: the renamed stereo pair.'),
      error: [HttpApiError.BadRequest, HttpApiError.NotFound],
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Rename a stereo pair",
        description:
          "Called by a speaker of the pair when the pair is renamed, and after power or source changes, with its own id as `masterDeviceId`. Only `name` is taken from the body. A pair the account doesn't have gets `404`; a body without a `name` gets `400`.",
      }),
    ),
    HttpApiEndpoint.delete(
      "removeGroup",
      "/account/:accountId/group/:groupId",
      {
        params: GroupParams,
        success: boseXml("`<status>Group deleted successfully</status>`."),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Remove a stereo pair",
        description:
          "Called by the speaker that was told to leave its pair (`removeGroup` on the speaker). Deletes the pair, if the account has it.",
      }),
    ),
    HttpApiEndpoint.delete("removeGroups", "/account/:accountId/group", {
      params: AccountParams,
      success: boseXml("`<status>Group deleted successfully</status>`."),
    }).annotateMerge(
      OpenApi.annotations({
        summary: "Acknowledge removing all stereo pairs",
        description:
          "Acknowledged without deleting anything: each speaker deletes its own pair by id.",
      }),
    ),
    HttpApiEndpoint.get(
      "providerSettings",
      "/account/:accountId/provider_settings",
      {
        params: AccountParams,
        success: boseXml(
          "`<providerSettings>`: `ELIGIBLE_FOR_TRIAL` set to `false` for Deezer (provider `14`).",
        ),
      },
    ).annotateMerge(
      OpenApi.annotations({
        summary: "Get provider settings",
        description:
          "Called by the speaker at boot to read the account's music provider settings. The account offers no Deezer source, so no trial either.",
      }),
    ),
  )
  .prefix("/streaming")
  .annotateMerge(
    OpenApi.annotations({
      title: "Marge",
      description:
        "The subset of Bose's Marge streaming server that SoundTouch speakers call once their `margeServerUrl` points at this server. Bodies are Bose XML (`application/vnd.bose.streaming-v1.2+xml`). Every call naming a speaker's device id records the speaker's contact, which the app reads back. A device id that isn't 12 hex digits (a MAC address), or an account id over 64 characters, gets `400`.",
    }),
  ) {}
