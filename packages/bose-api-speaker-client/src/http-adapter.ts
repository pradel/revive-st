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
  SourceStatus,
} from "./types/common.ts";
import type {
  AudioDspControlsResponse,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  BassCapabilitiesResponse,
  BassResponse,
  CapabilitiesResponse,
  InfoResponse,
  KeyPressRequest,
  NowPlayingResponse,
  PresetsResponse,
  SelectSourceRequest,
  SetAudioDspControlsRequest,
  SetLevelControlsRequest,
  SetToneControlsRequest,
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
  ): Promise<Result<TParsed, BoseApiError>> {
    const result = await this.fetchResult(path, { method: "GET" });
    if (!result.isOk()) {
      return new Err(result.error);
    }
    return BoseHttpAdapter.parseBody(result.value, parse);
  }

  private async post(
    path: string,
    body: string,
  ): Promise<Result<void, BoseApiError>> {
    const result = await this.fetchResult(path, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body,
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

    return new Ok(parse(root));
  }

  async pressKey(params: KeyPressRequest): Promise<Result<void, BoseApiError>> {
    const xml = `<key state="${escapeXml(params.state)}" sender="${escapeXml(params.sender)}">${escapeXml(params.key)}</key>`;
    return this.post("/key", xml);
  }

  async selectSource(
    params: SelectSourceRequest,
  ): Promise<Result<void, BoseApiError>> {
    const account = params.sourceAccount
      ? ` sourceAccount="${escapeXml(params.sourceAccount)}"`
      : "";
    const xml = `<ContentItem source="${escapeXml(params.source)}"${account}></ContentItem>`;
    return this.post("/select", xml);
  }

  async getSources(): Promise<Result<SourcesResponse, BoseApiError>> {
    return this.get("/sources", (root) => {
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
    });
  }

  async getBassCapabilities(): Promise<
    Result<BassCapabilitiesResponse, BoseApiError>
  > {
    return this.get("/bassCapabilities", (root) => {
      const bc =
        root.name === "bassCapabilities"
          ? root
          : getChild(root, "bassCapabilities");
      if (!bc) {
        throw new Error("Missing <bassCapabilities> element");
      }
      return {
        deviceID: bc.attributes.deviceID ?? "",
        bassAvailable: parseBool(getChildText(bc, "bassAvailable") ?? "false"),
        bassMin: parseIntSafe(getChildText(bc, "bassMin") ?? "0"),
        bassMax: parseIntSafe(getChildText(bc, "bassMax") ?? "0"),
        bassDefault: parseIntSafe(getChildText(bc, "bassDefault") ?? "0"),
      };
    });
  }

  async getBass(): Promise<Result<BassResponse, BoseApiError>> {
    return this.get("/bass", (root) => {
      const bassNode = root.name === "bass" ? root : getChild(root, "bass");
      if (!bassNode) {
        throw new Error("Missing <bass> element");
      }
      return {
        deviceID: bassNode.attributes.deviceID ?? "",
        targetbass: parseIntSafe(getChildText(bassNode, "targetbass") ?? "0"),
        actualbass: parseIntSafe(getChildText(bassNode, "actualbass") ?? "0"),
      };
    });
  }

  async setBass(value: number): Promise<Result<void, BoseApiError>> {
    return this.post("/bass", `<bass>${value}</bass>`);
  }

  async getZone(): Promise<Result<ZoneResponse, BoseApiError>> {
    return this.get("/getZone", (root) => {
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
    });
  }

  async setZone(params: SetZoneRequest): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (member) =>
          `<member ipaddress="${escapeXml(member.ipaddress)}">${escapeXml(member.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}" senderIPAddress="${escapeXml(params.senderIpAddress)}">${members}</zone>`;
    return this.post("/setZone", xml);
  }

  async addZoneSlave(params: {
    master: string;
    members: ZoneMember[];
  }): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (member) =>
          `<member ipaddress="${escapeXml(member.ipaddress)}">${escapeXml(member.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}">${members}</zone>`;
    return this.post("/addZoneSlave", xml);
  }

  async removeZoneSlave(params: {
    master: string;
    members: ZoneMember[];
  }): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (member) =>
          `<member ipaddress="${escapeXml(member.ipaddress)}">${escapeXml(member.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}">${members}</zone>`;
    return this.post("/removeZoneSlave", xml);
  }

  // The speaker shuts down its access point after receiving credentials, which
  // may cause a NetworkError on this call. Callers should treat NetworkError
  // as a successful delivery.
  async sendCredentials(
    ssid: string,
    password: string,
  ): Promise<Result<void, BoseApiError>> {
    const securityType = password ? "wpa_or_wpa2" : "none";
    const xml = `<AddWirelessProfile timeout="30"><profile ssid="${escapeXml(ssid)}" password="${escapeXml(password)}" securityType="${securityType}"></profile></AddWirelessProfile>`;
    return this.post("/addWirelessProfile", xml);
  }

  async getNowPlaying(): Promise<Result<NowPlayingResponse, BoseApiError>> {
    return this.get("/nowPlaying", parseNowPlaying);
  }

  async getTrackInfo(): Promise<Result<NowPlayingResponse, BoseApiError>> {
    return this.get("/trackInfo", parseNowPlaying);
  }

  async getVolume(): Promise<Result<VolumeResponse, BoseApiError>> {
    return this.get("/volume", (root) => {
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
    });
  }

  async setVolume(
    params: SetVolumeRequest,
  ): Promise<Result<void, BoseApiError>> {
    const mute =
      params.muteEnabled !== undefined
        ? `<muteenabled>${params.muteEnabled}</muteenabled>`
        : "";
    const xml = `<volume>${params.volume}${mute}</volume>`;
    return this.post("/volume", xml);
  }

  async getPresets(): Promise<Result<PresetsResponse, BoseApiError>> {
    return this.get("/presets", (root) => {
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
    });
  }

  async getInfo(): Promise<Result<InfoResponse, BoseApiError>> {
    return this.get("/info", (root) => {
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
          componentCategory: getChildText(component, "componentCategory") ?? "",
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
    });
  }

  async setName(name: string): Promise<Result<void, BoseApiError>> {
    return this.post("/name", `<name>${escapeXml(name)}</name>`);
  }

  async getCapabilities(): Promise<Result<CapabilitiesResponse, BoseApiError>> {
    return this.get("/capabilities", (root) => {
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
    });
  }

  async getAudioDspControls(): Promise<
    Result<AudioDspControlsResponse, BoseApiError>
  > {
    return this.get("/audiodspcontrols", (root) => {
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
    });
  }

  async setAudioDspControls(
    params: SetAudioDspControlsRequest,
  ): Promise<Result<void, BoseApiError>> {
    const attrs: string[] = [];
    if (params.audiomode !== undefined) {
      attrs.push(`audiomode="${params.audiomode}"`);
    }
    if (params.videosyncaudiodelay !== undefined) {
      attrs.push(`videosyncaudiodelay="${params.videosyncaudiodelay}"`);
    }
    const xml = `<audiodspcontrols ${attrs.join(" ")}/>`;
    return this.post("/audiodspcontrols", xml);
  }

  async getAudioProductToneControls(): Promise<
    Result<AudioProductToneControlsResponse, BoseApiError>
  > {
    return this.get("/audioproducttonecontrols", (root) => {
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
    });
  }

  async setAudioProductToneControls(
    params: SetToneControlsRequest,
  ): Promise<Result<void, BoseApiError>> {
    const parts: string[] = [];
    if (params.bass) {
      parts.push(`<bass value="${params.bass.value}" />`);
    }
    if (params.treble) {
      parts.push(`<treble value="${params.treble.value}" />`);
    }
    const xml = `<audioproducttonecontrols>${parts.join("")}</audioproducttonecontrols>`;
    return this.post("/audioproducttonecontrols", xml);
  }

  async getAudioProductLevelControls(): Promise<
    Result<AudioProductLevelControlsResponse, BoseApiError>
  > {
    return this.get("/audioproductlevelcontrols", (root) => {
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
    });
  }

  async setAudioProductLevelControls(
    params: SetLevelControlsRequest,
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
    return this.post("/audioproductlevelcontrols", xml);
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

function parseContentItem(node: XmlNode | undefined) {
  if (!node) {
    return {
      source: "",
      location: "",
      sourceAccount: "",
      isPresetable: false,
      itemName: "",
    };
  }
  return {
    source: node.attributes.source ?? "",
    location: node.attributes.location ?? "",
    sourceAccount: node.attributes.sourceAccount ?? "",
    isPresetable: parseBool(node.attributes.isPresetable ?? "false"),
    itemName: getChildText(node, "itemName") ?? "",
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

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
