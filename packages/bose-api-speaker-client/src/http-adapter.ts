import { Err, Ok, type Result } from "better-result";

import {
  ApiError,
  HttpError,
  NetworkError,
  XmlParseError,
  type BoseApiError,
} from "./errors.ts";
import type {
  ArtImageStatus,
  AudioMode,
  PlayStatus,
  RequestOptions,
  SourceStatus,
} from "./types/common.ts";
import type {
  AudioDspControlsResponse,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  BassCapabilitiesResponse,
  BassResponse,
  CapabilitiesResponse,
  ContentItem,
  InfoResponse,
  KeyPressRequest,
  NetworkInfoResponse,
  NowPlayingResponse,
  PresetsResponse,
  SelectSourceRequest,
  SetAudioDspControlsRequest,
  SetLevelControlsRequest,
  SetToneControlsRequest,
  SetupStateResponse,
  SetVolumeRequest,
  SetZoneRequest,
  SourcesResponse,
  VolumeResponse,
  ZoneMember,
  ZoneResponse,
} from "./types/index.ts";
import {
  getChild,
  getChildText,
  getChildren,
  parseBool,
  parseIntSafe,
  parseXml,
  type XmlNode,
} from "./xml-parser.ts";

export class BoseHttpAdapter {
  private readonly baseUrl: string;

  constructor(opts: { ip: string; port?: number }) {
    this.baseUrl = `http://${opts.ip}:${opts.port ?? 8090}`;
  }

  private async get<TParsed>(
    path: string,
    parse: (root: XmlNode) => TParsed,
    options: RequestOptions | undefined,
  ): Promise<Result<TParsed, BoseApiError>> {
    const result = await this.fetchResult(path, {
      method: "GET",
      signal: options?.signal,
    });
    if (!result.isOk()) {
      return new Err(result.error);
    }
    return BoseHttpAdapter.parseBody(result.value, parse);
  }

  private async post(
    path: string,
    body: string,
    options: RequestOptions | undefined,
  ): Promise<Result<void, BoseApiError>> {
    const result = await this.fetchResult(path, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body,
      signal: options?.signal,
    });
    if (!result.isOk()) {
      return new Err(result.error);
    }
    return new Ok(undefined);
  }

  private async fetchResult(
    path: string,
    init: RequestInit,
  ): Promise<Result<string, BoseApiError>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, init);
    } catch (networkError) {
      return new Err(
        new NetworkError({
          message:
            networkError instanceof Error
              ? networkError.message
              : String(networkError),
          cause: networkError,
        }),
      );
    }

    let body: string;
    try {
      body = await response.text();
    } catch (bodyError) {
      return new Err(
        new NetworkError({
          message:
            bodyError instanceof Error ? bodyError.message : String(bodyError),
          cause: bodyError,
        }),
      );
    }

    if (!response.ok) {
      const requestBody = typeof init.body === "string" ? init.body : undefined;
      const apiErrors = tryParseApiErrors(body, requestBody);
      if (apiErrors) {
        return new Err(apiErrors);
      }
      return new Err(
        new HttpError({
          statusCode: response.status,
          statusText: response.statusText,
          body,
        }),
      );
    }

    return new Ok(body);
  }

  private static parseBody<TParsed>(
    body: string,
    parse: (root: XmlNode) => TParsed,
  ): Result<TParsed, BoseApiError> {
    let root: XmlNode;
    try {
      root = parseXml(body);
    } catch (parseError) {
      return new Err(
        parseError instanceof XmlParseError
          ? parseError
          : new XmlParseError({
              message:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
              rawXml: body,
            }),
      );
    }

    const apiErrors = tryParseApiErrorsFromNode(root, body);
    if (apiErrors) {
      return new Err(apiErrors);
    }

    try {
      return new Ok(parse(root));
    } catch (shapeError) {
      return new Err(
        new XmlParseError({
          message:
            shapeError instanceof Error
              ? shapeError.message
              : String(shapeError),
          rawXml: body,
        }),
      );
    }
  }

  async pressKey(
    params: KeyPressRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const xml = `<key state="${escapeXml(params.state)}" sender="${escapeXml(params.sender)}">${escapeXml(params.key)}</key>`;
    return this.post("/key", xml, options);
  }

  async selectSource(
    params: SelectSourceRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const account = params.sourceAccount
      ? ` sourceAccount="${escapeXml(params.sourceAccount)}"`
      : "";
    const xml = `<ContentItem source="${escapeXml(params.source)}"${account}></ContentItem>`;
    return this.post("/select", xml, options);
  }

  async getSources(
    options?: RequestOptions,
  ): Promise<Result<SourcesResponse, BoseApiError>> {
    return this.get(
      "/sources",
      (root) => {
        const sources =
          root.name === "sources" ? root : getChild(root, "sources");
        if (!sources) {
          throw new Error("Missing <sources> element");
        }
        return {
          deviceID: sources.attributes.deviceID ?? "",
          sourceItems: getChildren(sources, "sourceItem").map((si) => ({
            source: si.attributes.source ?? "",
            sourceAccount: si.attributes.sourceAccount ?? "",
            status: (si.attributes.status as SourceStatus) ?? "",
            name: si.text,
          })),
        };
      },
      options,
    );
  }

  async getBassCapabilities(
    options?: RequestOptions,
  ): Promise<Result<BassCapabilitiesResponse, BoseApiError>> {
    return this.get(
      "/bassCapabilities",
      (root) => {
        const bc =
          root.name === "bassCapabilities"
            ? root
            : getChild(root, "bassCapabilities");
        if (!bc) {
          throw new Error("Missing <bassCapabilities> element");
        }
        return {
          deviceID: bc.attributes.deviceID ?? "",
          bassAvailable: parseBool(
            getChildText(bc, "bassAvailable") ?? "false",
          ),
          bassMin: parseIntSafe(getChildText(bc, "bassMin") ?? "0"),
          bassMax: parseIntSafe(getChildText(bc, "bassMax") ?? "0"),
          bassDefault: parseIntSafe(getChildText(bc, "bassDefault") ?? "0"),
        };
      },
      options,
    );
  }

  async getBass(
    options?: RequestOptions,
  ): Promise<Result<BassResponse, BoseApiError>> {
    return this.get(
      "/bass",
      (root) => {
        const bassNode = root.name === "bass" ? root : getChild(root, "bass");
        if (!bassNode) {
          throw new Error("Missing <bass> element");
        }
        return {
          deviceID: bassNode.attributes.deviceID ?? "",
          targetbass: parseIntSafe(getChildText(bassNode, "targetbass") ?? "0"),
          actualbass: parseIntSafe(getChildText(bassNode, "actualbass") ?? "0"),
        };
      },
      options,
    );
  }

  async setBass(
    value: number,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    return this.post("/bass", `<bass>${value}</bass>`, options);
  }

  async getZone(
    options?: RequestOptions,
  ): Promise<Result<ZoneResponse, BoseApiError>> {
    return this.get(
      "/getZone",
      (root) => {
        const zone = root.name === "zone" ? root : getChild(root, "zone");
        if (!zone) {
          throw new Error("Missing <zone> element");
        }
        return {
          master: zone.attributes.master ?? "",
          members: getChildren(zone, "member").map((member) => ({
            ipaddress: member.attributes.ipaddress ?? "",
            macAddress: member.text,
          })),
        };
      },
      options,
    );
  }

  async setZone(
    params: SetZoneRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (member) =>
          `<member ipaddress="${escapeXml(member.ipaddress)}">${escapeXml(member.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}" senderIPAddress="${escapeXml(params.senderIpAddress)}">${members}</zone>`;
    return this.post("/setZone", xml, options);
  }

  async addZoneSlave(
    params: {
      master: string;
      members: ZoneMember[];
    },
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (member) =>
          `<member ipaddress="${escapeXml(member.ipaddress)}">${escapeXml(member.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}">${members}</zone>`;
    return this.post("/addZoneSlave", xml, options);
  }

  async removeZoneSlave(
    params: {
      master: string;
      members: ZoneMember[];
    },
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (member) =>
          `<member ipaddress="${escapeXml(member.ipaddress)}">${escapeXml(member.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}">${members}</zone>`;
    return this.post("/removeZoneSlave", xml, options);
  }

  // The reply is held back while the speaker tries to join the network
  // (`timeout="30"` is the join timeout in seconds): OK once it joined, or an
  // ApiError WIFI_PROFILE_SETUP_FAILED (value 1035) when it could not, e.g.
  // NO_IP_ADDRESS_ASSIGNED for a wrong password. A NetworkError means the
  // outcome is unknown, not that the credentials were delivered.
  async sendCredentials(
    ssid: string,
    password: string,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const securityType = password ? "wpa_or_wpa2" : "none";
    const xml = `<AddWirelessProfile timeout="30"><profile ssid="${escapeXml(ssid)}" password="${escapeXml(password)}" securityType="${securityType}"></profile></AddWirelessProfile>`;
    return this.post("/addWirelessProfile", xml, options);
  }

  async getNowPlaying(
    options?: RequestOptions,
  ): Promise<Result<NowPlayingResponse, BoseApiError>> {
    return this.get("/nowPlaying", parseNowPlaying, options);
  }

  async getTrackInfo(
    options?: RequestOptions,
  ): Promise<Result<NowPlayingResponse, BoseApiError>> {
    return this.get("/trackInfo", parseNowPlaying, options);
  }

  async getVolume(
    options?: RequestOptions,
  ): Promise<Result<VolumeResponse, BoseApiError>> {
    return this.get(
      "/volume",
      (root) => {
        const volumeNode =
          root.name === "volume" ? root : getChild(root, "volume");
        if (!volumeNode) {
          throw new Error("Missing <volume> element");
        }
        return {
          deviceID: volumeNode.attributes.deviceID ?? "",
          targetvolume: parseIntSafe(
            getChildText(volumeNode, "targetvolume") ?? "0",
          ),
          actualvolume: parseIntSafe(
            getChildText(volumeNode, "actualvolume") ?? "0",
          ),
          muteenabled: parseBool(
            getChildText(volumeNode, "muteenabled") ?? "false",
          ),
        };
      },
      options,
    );
  }

  async setVolume(
    params: SetVolumeRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const mute =
      params.muteEnabled !== undefined
        ? `<muteenabled>${params.muteEnabled}</muteenabled>`
        : "";
    const xml = `<volume>${params.volume}${mute}</volume>`;
    return this.post("/volume", xml, options);
  }

  async getPresets(
    options?: RequestOptions,
  ): Promise<Result<PresetsResponse, BoseApiError>> {
    return this.get(
      "/presets",
      (root) => {
        const presets =
          root.name === "presets" ? root : getChild(root, "presets");
        if (!presets) {
          throw new Error("Missing <presets> element");
        }
        return {
          presets: getChildren(presets, "preset").map((pr) => ({
            id: parseIntSafe(pr.attributes.id ?? "0"),
            createdOn: pr.attributes.createdOn
              ? parseIntSafe(pr.attributes.createdOn)
              : undefined,
            updatedOn: pr.attributes.updatedOn
              ? parseIntSafe(pr.attributes.updatedOn)
              : undefined,
            contentItem: parseContentItem(getChild(pr, "ContentItem")),
          })),
        };
      },
      options,
    );
  }

  /**
   * Stores `contentItem` in preset slot `id`, replacing what was there, without
   * playing it. Missing from Bose's API reference; seen working on a
   * SoundTouch 10 (firmware 27), which then reports the preset to its Marge
   * server.
   */
  async storePreset(
    id: 1 | 2 | 3 | 4 | 5 | 6,
    contentItem: ContentItem,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    return this.post(
      "/storePreset",
      `<preset id="${id}">${contentItemXml(contentItem)}</preset>`,
      options,
    );
  }

  async getInfo(
    options?: RequestOptions,
  ): Promise<Result<InfoResponse, BoseApiError>> {
    return this.get(
      "/info",
      (root) => {
        const info = root.name === "info" ? root : getChild(root, "info");
        if (!info) {
          throw new Error("Missing <info> element");
        }
        const netInfo = getChild(info, "networkInfo");
        return {
          deviceID: info.attributes.deviceID ?? "",
          name: getChildText(info, "name") ?? "",
          type: getChildText(info, "type") ?? "",
          margeAccountUUID: getChildText(info, "margeAccountUUID") ?? "",
          components: getChildren(
            getChild(info, "components") ?? info,
            "component",
          ).map((component) => ({
            componentCategory:
              getChildText(component, "componentCategory") ?? "",
            softwareVersion: getChildText(component, "softwareVersion") ?? "",
            serialNumber: getChildText(component, "serialNumber") ?? "",
          })),
          margeURL: getChildText(info, "margeURL") ?? "",
          networkInfo: netInfo
            ? {
                type: netInfo.attributes.type ?? "",
                macAddress: getChildText(netInfo, "macAddress") ?? "",
                ipAddress: getChildText(netInfo, "ipAddress") ?? "",
              }
            : { type: "", macAddress: "", ipAddress: "" },
        };
      },
      options,
    );
  }

  async getNetworkInfo(
    options?: RequestOptions,
  ): Promise<Result<NetworkInfoResponse, BoseApiError>> {
    return this.get(
      "/networkInfo",
      (root) => {
        const networkInfo =
          root.name === "networkInfo" ? root : getChild(root, "networkInfo");
        if (!networkInfo) {
          throw new Error("Missing <networkInfo> element");
        }
        return {
          wifiProfileCount: optionalInt(
            networkInfo.attributes.wifiProfileCount,
          ),
          interfaces: getChildren(
            getChild(networkInfo, "interfaces") ?? networkInfo,
            "interface",
          ).map(({ attributes }) => ({
            name: attributes.name ?? "",
            type: optionalString(attributes.type),
            macAddress: optionalString(attributes.macAddress),
            ipAddress: optionalString(attributes.ipAddress),
            ssid: optionalString(attributes.ssid),
            frequencyKHz: optionalInt(attributes.frequencyKHz),
            state: optionalString(attributes.state),
            mode: optionalString(attributes.mode),
            signal: optionalString(attributes.signal),
          })),
        };
      },
      options,
    );
  }

  async getSetupState(
    options?: RequestOptions,
  ): Promise<Result<SetupStateResponse, BoseApiError>> {
    return this.get(
      "/setup",
      (root) => {
        const response =
          root.name === "setupStateResponse"
            ? root
            : getChild(root, "setupStateResponse");
        const state = optionalString(response?.attributes.state);
        if (!response || state === undefined) {
          throw new Error("Missing <setupStateResponse state> element");
        }
        return {
          state,
          systemState: optionalString(response.attributes.systemstate),
        };
      },
      options,
    );
  }

  async setSetupState(
    state: "SETUP_LEAVE",
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    return this.post("/setup", `<setupState state="${state}"/>`, options);
  }

  async setName(
    name: string,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    return this.post("/name", `<name>${escapeXml(name)}</name>`, options);
  }

  async getCapabilities(
    options?: RequestOptions,
  ): Promise<Result<CapabilitiesResponse, BoseApiError>> {
    return this.get(
      "/capabilities",
      (root) => {
        const caps =
          root.name === "capabilities" ? root : getChild(root, "capabilities");
        if (!caps) {
          throw new Error("Missing <capabilities> element");
        }
        return {
          deviceID: caps.attributes.deviceID ?? "",
          capabilities: getChildren(caps, "capability").map((capability) => ({
            name: capability.attributes.name ?? "",
            url: capability.attributes.url ?? "",
            info: capability.attributes.info ?? "",
          })),
        };
      },
      options,
    );
  }

  async getAudioDspControls(
    options?: RequestOptions,
  ): Promise<Result<AudioDspControlsResponse, BoseApiError>> {
    return this.get(
      "/audiodspcontrols",
      (root) => {
        const adc =
          root.name === "audiodspcontrols"
            ? root
            : getChild(root, "audiodspcontrols");
        if (!adc) {
          throw new Error("Missing <audiodspcontrols> element");
        }
        return {
          audiomode: (adc.attributes.audiomode ?? "") as AudioMode,
          videosyncaudiodelay: parseIntSafe(
            adc.attributes.videosyncaudiodelay ?? "0",
          ),
          supportedaudiomodes: (adc.attributes.supportedaudiomodes ?? "")
            .split("|")
            .filter(Boolean) as AudioMode[],
        };
      },
      options,
    );
  }

  async setAudioDspControls(
    params: SetAudioDspControlsRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const attrs: string[] = [];
    if (params.audiomode !== undefined) {
      attrs.push(`audiomode="${params.audiomode}"`);
    }
    if (params.videosyncaudiodelay !== undefined) {
      attrs.push(`videosyncaudiodelay="${params.videosyncaudiodelay}"`);
    }
    const xml = `<audiodspcontrols ${attrs.join(" ")}/>`;
    return this.post("/audiodspcontrols", xml, options);
  }

  async getAudioProductToneControls(
    options?: RequestOptions,
  ): Promise<Result<AudioProductToneControlsResponse, BoseApiError>> {
    return this.get(
      "/audioproducttonecontrols",
      (root) => {
        const aptc =
          root.name === "audioproducttonecontrols"
            ? root
            : getChild(root, "audioproducttonecontrols");
        if (!aptc) {
          throw new Error("Missing <audioproducttonecontrols> element");
        }
        return {
          bass: parseToneControl(getChild(aptc, "bass")),
          treble: parseToneControl(getChild(aptc, "treble")),
        };
      },
      options,
    );
  }

  async setAudioProductToneControls(
    params: SetToneControlsRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const parts: string[] = [];
    if (params.bass) {
      parts.push(`<bass value="${params.bass.value}" />`);
    }
    if (params.treble) {
      parts.push(`<treble value="${params.treble.value}" />`);
    }
    const xml = `<audioproducttonecontrols>${parts.join("")}</audioproducttonecontrols>`;
    return this.post("/audioproducttonecontrols", xml, options);
  }

  async getAudioProductLevelControls(
    options?: RequestOptions,
  ): Promise<Result<AudioProductLevelControlsResponse, BoseApiError>> {
    return this.get(
      "/audioproductlevelcontrols",
      (root) => {
        const aplc =
          root.name === "audioproductlevelcontrols"
            ? root
            : getChild(root, "audioproductlevelcontrols");
        if (!aplc) {
          throw new Error("Missing <audioproductlevelcontrols> element");
        }
        return {
          frontCenterSpeakerLevel: parseLevelControl(
            getChild(aplc, "frontCenterSpeakerLevel"),
          ),
          rearSurroundSpeakersLevel: parseLevelControl(
            getChild(aplc, "rearSurroundSpeakersLevel"),
          ),
        };
      },
      options,
    );
  }

  async setAudioProductLevelControls(
    params: SetLevelControlsRequest,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const parts: string[] = [];
    if (params.frontCenterSpeakerLevel) {
      parts.push(
        `<frontCenterSpeakerLevel value="${params.frontCenterSpeakerLevel.value}" />`,
      );
    }
    if (params.rearSurroundSpeakersLevel) {
      parts.push(
        `<rearSurroundSpeakersLevel value="${params.rearSurroundSpeakersLevel.value}" />`,
      );
    }
    const xml = `<audioproductlevelcontrols>${parts.join("")}</audioproductlevelcontrols>`;
    return this.post("/audioproductlevelcontrols", xml, options);
  }
}

function parseNowPlaying(root: XmlNode): NowPlayingResponse {
  const np = root.name === "nowPlaying" ? root : getChild(root, "nowPlaying");
  if (!np) {
    throw new Error("Missing <nowPlaying> element");
  }
  const art = getChild(np, "art");
  return {
    deviceID: np.attributes.deviceID ?? "",
    source: np.attributes.source ?? "",
    contentItem: parseContentItem(getChild(np, "ContentItem")),
    track: getChildText(np, "track") ?? "",
    artist: getChildText(np, "artist") ?? "",
    album: getChildText(np, "album") ?? "",
    stationName: getChildText(np, "stationName") ?? "",
    art: {
      artImageStatus: (art?.attributes.artImageStatus ?? "") as ArtImageStatus,
      url: art?.text ?? "",
    },
    playStatus: (getChildText(np, "playStatus") ?? "") as PlayStatus,
    description: getChildText(np, "description") ?? "",
    stationLocation: getChildText(np, "stationLocation") ?? "",
  };
}

function parseContentItem(node: XmlNode | undefined): ContentItem {
  if (!node) {
    return {
      source: "",
      type: "",
      location: "",
      sourceAccount: "",
      isPresetable: false,
      itemName: "",
      containerArt: "",
    };
  }
  return {
    source: node.attributes.source ?? "",
    type: node.attributes.type ?? "",
    location: node.attributes.location ?? "",
    sourceAccount: node.attributes.sourceAccount ?? "",
    isPresetable: parseBool(node.attributes.isPresetable ?? "false"),
    itemName: getChildText(node, "itemName") ?? "",
    containerArt: getChildText(node, "containerArt") ?? "",
  };
}

function parseToneControl(node: XmlNode | undefined) {
  if (!node) {
    return { value: 0, minValue: 0, maxValue: 0, step: 0 };
  }
  return {
    value: parseIntSafe(node.attributes.value ?? "0"),
    minValue: parseIntSafe(node.attributes.minValue ?? "0"),
    maxValue: parseIntSafe(node.attributes.maxValue ?? "0"),
    step: parseIntSafe(node.attributes.step ?? "0"),
  };
}

function parseLevelControl(node: XmlNode | undefined) {
  if (!node) {
    return { value: 0, minValue: 0, maxValue: 0, step: 0 };
  }
  return {
    value: parseIntSafe(node.attributes.value ?? "0"),
    minValue: parseIntSafe(node.attributes.minValue ?? "0"),
    maxValue: parseIntSafe(node.attributes.maxValue ?? "0"),
    step: parseIntSafe(node.attributes.step ?? "0"),
  };
}

function optionalString(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function optionalInt(value: string | undefined): number | undefined {
  const parsed = parseIntSafe(value ?? "");
  return Number.isNaN(parsed) ? undefined : parsed;
}

function tryParseApiErrors(body: string, requestXml?: string): ApiError | null {
  try {
    const root = parseXml(body);
    return tryParseApiErrorsFromNode(root, body, requestXml);
  } catch {
    return null;
  }
}

function tryParseApiErrorsFromNode(
  root: XmlNode,
  rawXml: string,
  requestXml?: string,
): ApiError | null {
  const errorsRoot = root.name === "errors" ? root : getChild(root, "errors");
  if (!errorsRoot) {
    return null;
  }
  return new ApiError({
    deviceID: errorsRoot.attributes.deviceID ?? "",
    errors: getChildren(errorsRoot, "error").map((errorEntry) => ({
      value: parseIntSafe(errorEntry.attributes.value ?? "0"),
      name: errorEntry.attributes.name ?? "",
      severity: errorEntry.attributes.severity ?? "",
      message: errorEntry.text,
    })),
    rawXml,
    requestXml,
  });
}

/** A `<ContentItem>` as `/select` and `/storePreset` take it. */
export function contentItemXml(item: ContentItem): string {
  return `<ContentItem source="${escapeXml(item.source)}" type="${escapeXml(
    item.type,
  )}" location="${escapeXml(item.location)}" sourceAccount="${escapeXml(
    item.sourceAccount,
  )}" isPresetable="${item.isPresetable}"><itemName>${escapeXml(
    item.itemName,
  )}</itemName><containerArt>${escapeXml(item.containerArt)}</containerArt></ContentItem>`;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
