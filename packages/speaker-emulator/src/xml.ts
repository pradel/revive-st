/**
 * The documents the speaker sends and reads: its own API on port 8090, its
 * WebSocket notifications, and the bodies it exchanges with its servers.
 * Shapes follow captured traffic of firmware 27 (repos/Bose-SoundTouch
 * fakespeaker fixtures and tests/integration/http-client).
 */
import {
  type ContentItem,
  contentItemXml,
  escapeXml,
  type Preset,
  parseXml,
  type XmlNode,
} from "bose-api-speaker-client";

import {
  type AccountSource,
  FIRMWARE_VERSION,
  SERVER_URL_FIELDS,
  type ServerUrls,
} from "./config.ts";
import {
  type Group,
  type GroupRole,
  type NowPlaying,
  type SpeakerState,
  sourceItems,
} from "./state.ts";

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" ?>';

const child = (node: XmlNode, name: string) =>
  node.children.find((candidate) => candidate.name === name);

const childText = (node: XmlNode, name: string) => child(node, name)?.text;

const children = (node: XmlNode | undefined, name: string) =>
  node?.children.filter((candidate) => candidate.name === name) ?? [];

const element = (name: string, value: string) =>
  `<${name}>${escapeXml(value)}</${name}>`;

// ---------------------------------------------------------------------------
// Port 8090

export interface Identity {
  readonly deviceId: string;
  readonly type: string;
  readonly ipAddress: string;
}

export const serialNumber = (deviceId: string) => `EMU${deviceId}`;

export const infoXml = (identity: Identity, state: SpeakerState) =>
  [
    XML_DECLARATION,
    `<info deviceID="${escapeXml(identity.deviceId)}">`,
    element("name", state.name),
    element("type", identity.type),
    element("margeAccountUUID", state.margeAccountUUID),
    "<components>",
    ...["SCM", "PackagedProduct"].map((category) =>
      [
        "<component>",
        element("componentCategory", category),
        element("softwareVersion", FIRMWARE_VERSION),
        element("serialNumber", serialNumber(identity.deviceId)),
        "</component>",
      ].join(""),
    ),
    "</components>",
    element("margeURL", state.running.margeServerUrl),
    ...["SCM", "SMSC"].map((type) =>
      [
        `<networkInfo type="${type}">`,
        // Firmware 27 writes MAC addresses without separators.
        element("macAddress", identity.deviceId),
        element("ipAddress", identity.ipAddress),
        "</networkInfo>",
      ].join(""),
    ),
    "<moduleType>sm2</moduleType>",
    "<variant>rhino</variant>",
    "<variantMode>normal</variantMode>",
    "<countryCode>GB</countryCode>",
    "<regionCode>GB</regionCode>",
    "</info>",
  ].join("");

export const networkInfoXml = (identity: Identity) =>
  [
    XML_DECLARATION,
    '<networkInfo wifiProfileCount="1"><interfaces>',
    `<interface type="WIFI_INTERFACE" name="wlan0" macAddress="${escapeXml(identity.deviceId)}" ipAddress="${escapeXml(identity.ipAddress)}" ssid="Emulated" frequencyKHz="5500000" state="NETWORK_WIFI_CONNECTED" signal="EXCELLENT_SIGNAL" mode="STATION"/>`,
    "</interfaces></networkInfo>",
  ].join("");

const presetsBody = (presets: readonly Preset[]) =>
  presets.length === 0
    ? "<presets />"
    : `<presets>${presets
        .map(
          (preset) =>
            `<preset id="${preset.id}"${
              preset.createdOn === undefined
                ? ""
                : ` createdOn="${preset.createdOn}"`
            }${
              preset.updatedOn === undefined
                ? ""
                : ` updatedOn="${preset.updatedOn}"`
            }>${contentItemXml(preset.contentItem)}</preset>`,
        )
        .join("")}</presets>`;

export const presetsXml = (presets: readonly Preset[]) =>
  `${XML_DECLARATION}${presetsBody(presets)}`;

const volumeBody = (deviceId: string, state: SpeakerState) =>
  `<volume deviceID="${escapeXml(deviceId)}"><targetvolume>${state.volume}</targetvolume><actualvolume>${state.volume}</actualvolume><muteenabled>${state.muted}</muteenabled></volume>`;

export const volumeXml = (deviceId: string, state: SpeakerState) =>
  `${XML_DECLARATION}${volumeBody(deviceId, state)}`;

export const bassXml = (deviceId: string, state: SpeakerState) =>
  `${XML_DECLARATION}<bass deviceID="${escapeXml(deviceId)}"><targetbass>${state.bass}</targetbass><actualbass>${state.bass}</actualbass></bass>`;

const nowPlayingBody = (deviceId: string, nowPlaying: NowPlaying) => {
  const id = escapeXml(deviceId);
  if (nowPlaying.kind === "standby") {
    return `<nowPlaying deviceID="${id}" source="STANDBY"><ContentItem source="STANDBY" isPresetable="false" /></nowPlaying>`;
  }
  if (nowPlaying.kind === "invalid") {
    return `<nowPlaying deviceID="${id}" source="INVALID_SOURCE"><ContentItem source="INVALID_SOURCE" isPresetable="true" /></nowPlaying>`;
  }
  const { contentItem } = nowPlaying;
  return [
    `<nowPlaying deviceID="${id}" source="${escapeXml(contentItem.source)}" sourceAccount="${escapeXml(contentItem.sourceAccount)}">`,
    contentItemXml(contentItem),
    "<track></track><artist></artist><album></album>",
    element("stationName", nowPlaying.stationName),
    `<art artImageStatus="${nowPlaying.art === "" ? "SHOW_DEFAULT_IMAGE" : "IMAGE_PRESENT"}">${escapeXml(nowPlaying.art)}</art>`,
    element("playStatus", nowPlaying.playStatus),
    "<description></description><stationLocation></stationLocation>",
    "</nowPlaying>",
  ].join("");
};

export const nowPlayingXml = (deviceId: string, nowPlaying: NowPlaying) =>
  `${XML_DECLARATION}${nowPlayingBody(deviceId, nowPlaying)}`;

export const sourcesXml = (deviceId: string, state: SpeakerState) =>
  [
    XML_DECLARATION,
    `<sources deviceID="${escapeXml(deviceId)}">`,
    ...sourceItems(state).map(
      ({ source, sourceAccount, status, name, isLocal }) =>
        `<sourceItem source="${escapeXml(source)}" sourceAccount="${escapeXml(sourceAccount)}" status="${status}" isLocal="${isLocal}" multiroomallowed="true">${escapeXml(name)}</sourceItem>`,
    ),
    "</sources>",
  ].join("");

/** The reply to a POST the speaker accepted, naming its path. */
export const statusXml = (path: string) =>
  `${XML_DECLARATION}<status>${escapeXml(path)}</status>`;

/** An error reply, as `ApiError` in bose-api-speaker-client reads it. */
export const errorsXml = (
  deviceId: string,
  error: {
    readonly value: number;
    readonly name: string;
    readonly message: string;
  },
) =>
  `${XML_DECLARATION}<errors deviceID="${escapeXml(deviceId)}"><error value="${error.value}" name="${escapeXml(error.name)}" severity="Unknown">${escapeXml(error.message)}</error></errors>`;

/**
 * A stereo pair as `/getGroup` and `groupUpdated` report it; `<group />`
 * when the speaker isn't in one. Both speakers report the master's address
 * as `senderIPAddress`.
 */
const groupBody = (group: Group | undefined) =>
  group === undefined
    ? "<group />"
    : [
        `<group id="${escapeXml(group.id)}">`,
        element("name", group.name),
        element("masterDeviceId", group.masterDeviceId),
        "<roles>",
        ...group.roles.map(
          ({ deviceId, role, ipAddress }) =>
            `<groupRole>${element("deviceId", deviceId)}${element("role", role)}${element("ipAddress", ipAddress)}</groupRole>`,
        ),
        "</roles>",
        element(
          "senderIPAddress",
          group.roles.find(({ deviceId }) => deviceId === group.masterDeviceId)
            ?.ipAddress ?? "",
        ),
        "<status>GROUP_OK</status>",
        "</group>",
      ].join("");

export const groupXml = (group: Group | undefined) =>
  `${XML_DECLARATION}${groupBody(group)}`;

/** What a speaker answers when its partner didn't take a group request. */
export const PEER_REQUEST_FAILED_XML = `${XML_DECLARATION}<group><status>GROUP_PEER_REQUEST_FAILED</status></group>`;

// ---------------------------------------------------------------------------
// WebSocket notifications on port 8080

/** What a speaker sends first on every WebSocket connection. */
export const SDK_INFO_XML =
  '<SoundTouchSdkInfo serverVersion="4" serverBuild="trunk r46330 v4 epdbuild hepdswbld04" />';

const updates = (deviceId: string, body: string) =>
  `<updates deviceID="${escapeXml(deviceId)}">${body}</updates>`;

export const volumeUpdated = (deviceId: string, state: SpeakerState) =>
  updates(
    deviceId,
    `<volumeUpdated>${volumeBody(deviceId, state)}</volumeUpdated>`,
  );

export const nowPlayingUpdated = (deviceId: string, nowPlaying: NowPlaying) =>
  updates(
    deviceId,
    `<nowPlayingUpdated>${nowPlayingBody(deviceId, nowPlaying)}</nowPlayingUpdated>`,
  );

export const nowSelectionUpdated = (
  deviceId: string,
  presetId: number,
  contentItem: ContentItem,
) =>
  updates(
    deviceId,
    `<nowSelectionUpdated><preset id="${presetId}">${contentItemXml(contentItem)}</preset></nowSelectionUpdated>`,
  );

export const presetsUpdated = (deviceId: string, presets: readonly Preset[]) =>
  updates(deviceId, `<presetsUpdated>${presetsBody(presets)}</presetsUpdated>`);

/** As exported speaker logs show it (repos/streborn/anonymise/anonymise.go). */
export const nameUpdated = (deviceId: string, name: string) =>
  updates(deviceId, element("nameUpdated", name));

export const sourcesUpdated = (deviceId: string) =>
  updates(deviceId, "<sourcesUpdated />");

export const infoUpdated = (deviceId: string) =>
  updates(deviceId, "<infoUpdated />");

/** Unlike the other updates, `deviceID` is single-quoted (captured, firmware 27.0.6). */
export const groupUpdated = (deviceId: string, group: Group | undefined) =>
  `<updates deviceID='${escapeXml(deviceId)}'><groupUpdated>${groupBody(group)}</groupUpdated></updates>`;

// ---------------------------------------------------------------------------
// Request bodies sent to port 8090

const parse = (xml: string): XmlNode | undefined => {
  try {
    return parseXml(xml);
  } catch {
    return undefined;
  }
};

const contentItemFrom = (node: XmlNode): ContentItem => ({
  source: node.attributes.source ?? "",
  type: node.attributes.type ?? "",
  location: node.attributes.location ?? "",
  sourceAccount: node.attributes.sourceAccount ?? "",
  isPresetable: node.attributes.isPresetable === "true",
  itemName: childText(node, "itemName") ?? "",
  containerArt: childText(node, "containerArt") ?? "",
});

/** `<volume>30</volume>`, optionally with `<muteenabled>`. */
export const readVolume = (xml: string) => {
  const root = parse(xml);
  const volume = Number.parseInt(root?.text.trim() ?? "", 10);
  if (root?.name !== "volume" || Number.isNaN(volume)) {
    return undefined;
  }
  const mute = childText(root, "muteenabled");
  return { volume, muted: mute === undefined ? undefined : mute === "true" };
};

export const readBass = (xml: string) => {
  const root = parse(xml);
  const bass = Number.parseInt(root?.text.trim() ?? "", 10);
  return root?.name === "bass" && !Number.isNaN(bass) ? bass : undefined;
};

export const readName = (xml: string) => {
  const root = parse(xml);
  return root?.name === "name" ? root.text : undefined;
};

export const readKey = (xml: string) => {
  const root = parse(xml);
  return root?.name === "key"
    ? { key: root.text.trim(), state: root.attributes.state ?? "" }
    : undefined;
};

export const readContentItem = (xml: string) => {
  const root = parse(xml);
  return root?.name === "ContentItem" ? contentItemFrom(root) : undefined;
};

/** `<preset id="n"><ContentItem …/></preset>` as `/storePreset` takes it. */
export const readStoredPreset = (xml: string) => {
  const root = parse(xml);
  const id = Number.parseInt(root?.attributes.id ?? "", 10);
  const item = root && child(root, "ContentItem");
  return root?.name === "preset" && id >= 1 && id <= 6 && item
    ? { id, contentItem: contentItemFrom(item) }
    : undefined;
};

export const readAccountId = (xml: string) => {
  const root = parse(xml);
  const accountId =
    root?.name === "PairDeviceWithAccount"
      ? childText(root, "accountId")?.trim()
      : undefined;
  return accountId === "" ? undefined : accountId;
};

/** Whether a `/notification` body says the speaker's sources changed. */
export const isSourcesUpdated = (xml: string) => {
  const root = parse(xml);
  return (
    root?.name === "updates" && child(root, "sourcesUpdated") !== undefined
  );
};

/**
 * The pair `/addGroup` and `/updateGroup` take: a name, its master and one
 * LEFT and one RIGHT speaker, the master among them. `id` is set for
 * `/updateGroup`.
 */
export const readGroup = (xml: string) => {
  const root = parse(xml);
  const masterDeviceId =
    root?.name === "group"
      ? childText(root, "masterDeviceId")?.trim()
      : undefined;
  if (root === undefined || !masterDeviceId) {
    return undefined;
  }
  const roles = children(child(root, "roles"), "groupRole").flatMap(
    (node): GroupRole[] => {
      const deviceId = childText(node, "deviceId")?.trim();
      const role = childText(node, "role")?.trim();
      return deviceId && (role === "LEFT" || role === "RIGHT")
        ? [
            {
              deviceId,
              role,
              ipAddress: childText(node, "ipAddress")?.trim() ?? "",
            },
          ]
        : [];
    },
  );
  const left = roles.find(({ role }) => role === "LEFT");
  const right = roles.find(({ role }) => role === "RIGHT");
  return roles.length === 2 &&
    left !== undefined &&
    right !== undefined &&
    left.deviceId !== right.deviceId &&
    (left.deviceId === masterDeviceId || right.deviceId === masterDeviceId)
    ? {
        id: root.attributes.id,
        name: childText(root, "name") ?? "",
        masterDeviceId,
        roles: [left, right],
      }
    : undefined;
};

// ---------------------------------------------------------------------------
// Port 17000

/** The reply to `getpdo CurrentSystemConfiguration`: the running addresses. */
export const configurationReply = (urls: ServerUrls) =>
  SERVER_URL_FIELDS.map(
    (field) => `${field} {\r\n  text: "${urls[field]}"\r\n}\r\n`,
  ).join("");

// ---------------------------------------------------------------------------
// Bodies sent to the servers

/** The `<device-data>` report a speaker posts to `power_on` at every start. */
export const powerOnXml = ({ deviceId, type, ipAddress }: Identity) =>
  [
    XML_DECLARATION,
    "<device-data>",
    `<device id="${escapeXml(deviceId)}">`,
    element("serialnumber", serialNumber(deviceId)),
    element("firmware-version", FIRMWARE_VERSION),
    `<product product_code="${escapeXml(type)} sm2" type="5">`,
    element("serialnumber", serialNumber(deviceId)),
    "</product>",
    "</device>",
    "<diagnostic-data><device-landscape>",
    "<rssi>Excellent</rssi>",
    "<macaddresses>",
    element("macaddress", deviceId),
    "</macaddresses>",
    element("ip-address", ipAddress),
    "<network-connection-type>Wireless</network-connection-type>",
    "</device-landscape></diagnostic-data>",
    "</device-data>",
  ].join("");

/** A stats event (`scmudc`), as speakers post them at boot. */
export const statsEventJson = (
  { deviceId, type }: Identity,
  accountId: string,
  sentAt: Date,
) =>
  JSON.stringify({
    envelope: {
      monoTime: 0,
      payloadProtocolVersion: "3.1",
      payloadType: "scmudc",
      protocolVersion: "1.0",
      time: sentAt.toISOString(),
      uniqueId: deviceId,
    },
    payload: {
      deviceInfo: {
        boseID: accountId,
        deviceID: deviceId,
        deviceType: type,
        serialNumber: serialNumber(deviceId),
        softwareVersion: FIRMWARE_VERSION,
        systemSerialNumber: serialNumber(deviceId),
      },
      events: [{ type: "power-on", data: {} }],
    },
  });

/** The `<device>` document a speaker sends to pair with an account or rename itself. */
export const deviceXml = (deviceId: string, name: string) =>
  `${XML_DECLARATION}<device deviceid="${escapeXml(deviceId)}">${element("name", name)}${element("macaddress", deviceId)}</device>`;

/** The `<preset>` a speaker PUTs when one of its presets is stored. */
export const presetPutXml = (
  presetId: number,
  sourceId: string,
  contentItem: ContentItem,
) =>
  [
    XML_DECLARATION,
    `<preset buttonNumber="${presetId}">`,
    element("sourceid", sourceId),
    element("name", contentItem.itemName),
    element("username", contentItem.itemName),
    element("location", contentItem.location),
    element("contentItemType", contentItem.type),
    element("containerArt", contentItem.containerArt),
    "</preset>",
  ].join("");

/** The `<recent>` a speaker POSTs when it starts playing. */
export const recentXml = (
  sourceId: string,
  contentItem: ContentItem,
  playedAt: Date,
) =>
  [
    XML_DECLARATION,
    "<recent>",
    element("lastplayedat", playedAt.toISOString().replace("Z", "+00:00")),
    element("sourceid", sourceId),
    element("name", contentItem.itemName),
    element("location", contentItem.location),
    element("contentItemType", contentItem.type),
    "</recent>",
  ].join("");

/** The pair the master POSTs to Marge to create it: no id, no addresses. */
export const margeGroupXml = ({
  name,
  masterDeviceId,
  roles,
}: Omit<Group, "id">) =>
  [
    XML_DECLARATION,
    "<group>",
    element("masterDeviceId", masterDeviceId),
    element("name", name),
    "<roles>",
    ...roles.map(
      ({ deviceId, role }) =>
        `<groupRole>${element("deviceId", deviceId)}${element("role", role)}</groupRole>`,
    ),
    "</roles>",
    "</group>",
  ].join("");

/**
 * What a speaker PUTs to its pair on Marge when it renames it, naming itself
 * as master whichever speaker it is.
 */
export const margeGroupTouchXml = (deviceId: string, name: string) =>
  `${XML_DECLARATION}<group>${element("masterDeviceId", deviceId)}${element("name", name)}</group>`;

// ---------------------------------------------------------------------------
// Documents read from the servers

/** `/sourceproviders`: source type by provider id. */
export const readSourceProviders = (
  xml: string,
): ReadonlyMap<string, string> => {
  const root = parse(xml);
  return new Map(
    children(root, "sourceprovider").flatMap((provider) => {
      const name = childText(provider, "name");
      return provider.attributes.id === undefined || name === undefined
        ? []
        : [[provider.attributes.id, name] as const];
    }),
  );
};

/** The id of a `<group id="…">` from Marge; `undefined` for `<group/>` or anything else. */
export const readMargeGroupId = (xml: string) => {
  const root = parse(xml);
  const id = root?.name === "group" ? root.attributes.id?.trim() : undefined;
  return id === "" ? undefined : id;
};

/** What a speaker takes from its account's `/full`. */
export interface AccountSync {
  readonly sources: readonly AccountSource[];
  /**
   * `absent`: the account doesn't list the speaker. `keep`: it lists it
   * without `<presets>`. Otherwise the presets to replace the speaker's with.
   */
  readonly presets: "absent" | "keep" | readonly Preset[];
}

const accountSource = (
  node: XmlNode,
  providers: ReadonlyMap<string, string>,
): AccountSource | undefined => {
  const id = node.attributes.id;
  const source = providers.get(childText(node, "sourceproviderid") ?? "");
  return id === undefined || source === undefined
    ? undefined
    : { id, source, sourceAccount: childText(node, "username") ?? "" };
};

const presetFromAccount = (
  node: XmlNode,
  providers: ReadonlyMap<string, string>,
): Preset | undefined => {
  const id = Number.parseInt(node.attributes.buttonNumber ?? "", 10);
  const sourceNode = child(node, "source");
  const source = sourceNode && accountSource(sourceNode, providers);
  if (Number.isNaN(id) || source === undefined) {
    return undefined;
  }
  const updatedOn = Date.parse(childText(node, "updatedOn") ?? "");
  const createdOn = Date.parse(childText(node, "createdOn") ?? "");
  return {
    id,
    ...(Number.isNaN(createdOn)
      ? {}
      : { createdOn: Math.floor(createdOn / 1000) }),
    ...(Number.isNaN(updatedOn)
      ? {}
      : { updatedOn: Math.floor(updatedOn / 1000) }),
    contentItem: {
      source: source.source,
      type: childText(node, "contentItemType") ?? "",
      location: childText(node, "location") ?? "",
      sourceAccount: source.sourceAccount,
      isPresetable: true,
      itemName: childText(node, "name") ?? "",
      containerArt: childText(node, "containerArt") ?? "",
    },
  };
};

export const readAccount = (
  xml: string,
  deviceId: string,
  providers: ReadonlyMap<string, string>,
): AccountSync | undefined => {
  const root = parse(xml);
  if (root?.name !== "account") {
    return undefined;
  }
  const sources = children(child(root, "sources"), "source").flatMap((node) => {
    const source = accountSource(node, providers);
    return source ? [source] : [];
  });
  const device = children(child(root, "devices"), "device").find(
    (node) =>
      node.attributes.deviceid?.toUpperCase() === deviceId.toUpperCase(),
  );
  if (device === undefined) {
    return { sources, presets: "absent" };
  }
  const presetsNode = child(device, "presets");
  return {
    sources,
    presets:
      presetsNode === undefined
        ? "keep"
        : children(presetsNode, "preset").flatMap((node) => {
            const preset = presetFromAccount(node, providers);
            return preset ? [preset] : [];
          }),
  };
};
