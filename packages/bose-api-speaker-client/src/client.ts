import { Err, Ok, type Result } from "better-result";
import { ApiError, HttpError, NetworkError, XmlParseError } from "./errors.ts";
import type { BoseApiError } from "./errors.ts";
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
import type {
  ArtImageStatus,
  AudioMode,
  PlayStatus,
  SourceStatus,
} from "./types/common.ts";

type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

function parseXml(xml: string): XmlNode {
  const tagRegex =
    /<(\/?)([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_-]+="[^"]*")*)\s*(\/?)>/g;
  const valueRegex = /<[^>]*>/;
  const tokens: Array<{
    type: "open" | "close" | "selfClose";
    name: string;
    attrs: Record<string, string>;
  }> = [];

  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const texts: string[] = [];

  while ((match = tagRegex.exec(xml)) !== null) {
    const beforeTag = xml.slice(lastIndex, match.index);
    texts.push(beforeTag);
    lastIndex = tagRegex.lastIndex;

    const [, closing, name, attrStr, selfClose] = match;
    const attrs: Record<string, string> = {};
    if (attrStr) {
      const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let am: RegExpExecArray | null;
      while ((am = attrRegex.exec(attrStr)) !== null) {
        attrs[am[1]] = am[2];
      }
    }

    if (selfClose) {
      tokens.push({ type: "selfClose", name, attrs });
    } else if (closing) {
      tokens.push({ type: "close", name, attrs });
    } else {
      tokens.push({ type: "open", name, attrs });
    }
  }

  texts.push(xml.slice(lastIndex));

  let textIndex = 0;
  const stack: XmlNode[] = [];

  function getNextText(): string {
    return (texts[textIndex++] ?? "").trim();
  }

  function cleanText(text: string): string {
    return text
      .replace(/^<\?xml[^>]*\?>\s*/, "")
      .replace(valueRegex, "")
      .trim();
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const text = getNextText();

    if (token.type === "open") {
      const node: XmlNode = {
        name: token.name,
        attributes: token.attrs,
        children: [],
        text: "",
      };
      stack.push(node);
    } else if (token.type === "selfClose") {
      const node: XmlNode = {
        name: token.name,
        attributes: token.attrs,
        children: [],
        text: "",
      };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        stack.push(node);
      }
    } else if (token.type === "close") {
      const node = stack.pop();
      if (!node) throw new Error(`Unexpected closing tag </${token.name}>`);
      if (node.name !== token.name)
        throw new Error(`Mismatched tags: <${node.name}> and </${token.name}>`);

      node.text = cleanText(text);

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        stack.push(node);
      }
    }
  }

  const root = stack[0];
  if (!root)
    throw new XmlParseError({ message: "Empty XML document", rawXml: xml });
  return root;
}

function getChild(root: XmlNode, name: string): XmlNode | undefined {
  return root.children.find((c) => c.name === name);
}

function getChildText(root: XmlNode, name: string): string | undefined {
  return getChild(root, name)?.text;
}

function getChildren(root: XmlNode, name: string): XmlNode[] {
  return root.children.filter((c) => c.name === name);
}

function parseBool(s: string): boolean {
  return s.toLowerCase() === "true";
}

function parseIntSafe(s: string): number {
  return Number.parseInt(s, 10);
}

export class BoseSpeakerClient {
  private baseUrl: string;

  constructor(opts: { ip: string; port?: number }) {
    this.baseUrl = `http://${opts.ip}:${opts.port ?? 8090}`;
  }

  private async get<T>(
    path: string,
    parse: (root: XmlNode) => T,
  ): Promise<Result<T, BoseApiError>> {
    const result = await this.fetchResult(path, { method: "GET" });
    if (!result.isOk()) return new Err(result.error);
    return this.parseBody(result.value, parse);
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
    if (!result.isOk()) return new Err(result.error);
    return new Ok(undefined);
  }

  private async postParse<T>(
    path: string,
    body: string,
    parse: (root: XmlNode) => T,
  ): Promise<Result<T, BoseApiError>> {
    const result = await this.fetchResult(path, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body,
    });
    if (!result.isOk()) return new Err(result.error);
    return this.parseBody(result.value, parse);
  }

  private async fetchResult(
    path: string,
    init: RequestInit,
  ): Promise<Result<string, BoseApiError>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, init);
    } catch (e) {
      return new Err(
        new NetworkError({
          message: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
      );
    }

    const body = await response.text();

    if (!response.ok) {
      const apiErrors = tryParseApiErrors(body);
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

  private parseBody<T>(
    body: string,
    parse: (root: XmlNode) => T,
  ): Result<T, BoseApiError> {
    let root: XmlNode;
    try {
      root = parseXml(body);
    } catch (e) {
      return new Err(
        e instanceof XmlParseError
          ? e
          : new XmlParseError({
              message: e instanceof Error ? e.message : String(e),
              rawXml: body,
            }),
      );
    }

    const apiErrors = tryParseApiErrorsFromNode(root);
    if (apiErrors) return new Err(apiErrors);

    return new Ok(parse(root));
  }

  async pressKey(params: KeyPressRequest): Promise<Result<void, BoseApiError>> {
    const xml = `<key state="${params.state}" sender="${params.sender}">${params.key}</key>`;
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
      if (!sources) throw new Error("Missing <sources> element");
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
      if (!bc) throw new Error("Missing <bassCapabilities> element");
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
      const b = root.name === "bass" ? root : getChild(root, "bass");
      if (!b) throw new Error("Missing <bass> element");
      return {
        deviceID: b.attributes.deviceID ?? "",
        targetbass: parseIntSafe(getChildText(b, "targetbass") ?? "0"),
        actualbass: parseIntSafe(getChildText(b, "actualbass") ?? "0"),
      };
    });
  }

  async setBass(value: number): Promise<Result<void, BoseApiError>> {
    return this.post("/bass", `<bass>${value}</bass>`);
  }

  async getZone(): Promise<Result<ZoneResponse, BoseApiError>> {
    return this.get("/getZone", (root) => {
      const zone = root.name === "zone" ? root : getChild(root, "zone");
      if (!zone) throw new Error("Missing <zone> element");
      return {
        master: zone.attributes.master ?? "",
        members: getChildren(zone, "member").map((m) => ({
          ipaddress: m.attributes.ipaddress ?? "",
          macAddress: m.text,
        })),
      };
    });
  }

  async setZone(params: SetZoneRequest): Promise<Result<void, BoseApiError>> {
    const members = params.members
      .map(
        (m) =>
          `<member ipaddress="${escapeXml(m.ipaddress)}">${escapeXml(m.macAddress)}</member>`,
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
        (m) =>
          `<member ipaddress="${escapeXml(m.ipaddress)}">${escapeXml(m.macAddress)}</member>`,
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
        (m) =>
          `<member ipaddress="${escapeXml(m.ipaddress)}">${escapeXml(m.macAddress)}</member>`,
      )
      .join("");
    const xml = `<zone master="${escapeXml(params.master)}">${members}</zone>`;
    return this.post("/removeZoneSlave", xml);
  }

  async getNowPlaying(): Promise<Result<NowPlayingResponse, BoseApiError>> {
    return this.get("/nowPlaying", parseNowPlaying);
  }

  async getTrackInfo(): Promise<Result<NowPlayingResponse, BoseApiError>> {
    return this.get("/trackInfo", parseNowPlaying);
  }

  async getVolume(): Promise<Result<VolumeResponse, BoseApiError>> {
    return this.get("/volume", (root) => {
      const v = root.name === "volume" ? root : getChild(root, "volume");
      if (!v) throw new Error("Missing <volume> element");
      return {
        deviceID: v.attributes.deviceID ?? "",
        targetvolume: parseIntSafe(getChildText(v, "targetvolume") ?? "0"),
        actualvolume: parseIntSafe(getChildText(v, "actualvolume") ?? "0"),
        muteenabled: parseBool(getChildText(v, "muteenabled") ?? "false"),
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
      if (!presets) throw new Error("Missing <presets> element");
      return {
        presets: getChildren(presets, "preset").map((pr) => ({
          id: parseIntSafe(pr.attributes.id ?? "0"),
          createdOn: pr.attributes.createdOn
            ? parseIntSafe(pr.attributes.createdOn)
            : undefined,
          updatedOn: pr.attributes.updatedOn
            ? parseIntSafe(pr.attributes.updatedOn)
            : undefined,
          contentItem: parseContentItem(getChild(pr, "ContentItem")!),
        })),
      };
    });
  }

  async getInfo(): Promise<Result<InfoResponse, BoseApiError>> {
    return this.get("/info", (root) => {
      const info = root.name === "info" ? root : getChild(root, "info");
      if (!info) throw new Error("Missing <info> element");
      const netInfo = getChild(info, "networkInfo");
      return {
        deviceID: info.attributes.deviceID ?? "",
        name: getChildText(info, "name") ?? "",
        type: getChildText(info, "type") ?? "",
        margeAccountUUID: getChildText(info, "margeAccountUUID") ?? "",
        components: getChildren(info, "component").map((c) => ({
          componentCategory: getChildText(c, "componentCategory") ?? "",
          softwareVersion: getChildText(c, "softwareVersion") ?? "",
          serialNumber: getChildText(c, "serialNumber") ?? "",
        })),
        margeURL: getChildText(info, "margeURL") ?? "",
        networkInfo: {
          type: netInfo?.attributes.type ?? "",
          macAddress: getChildText(netInfo!, "macAddress") ?? "",
          ipAddress: getChildText(netInfo!, "ipAddress") ?? "",
        },
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
      if (!caps) throw new Error("Missing <capabilities> element");
      return {
        deviceID: caps.attributes.deviceID ?? "",
        capabilities: getChildren(caps, "capability").map((c) => ({
          name: c.attributes.name ?? "",
          url: c.attributes.url ?? "",
          info: c.attributes.info ?? "",
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
      if (!adc) throw new Error("Missing <audiodspcontrols> element");
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
    if (params.audiomode !== undefined)
      attrs.push(`audiomode="${params.audiomode}"`);
    if (params.videosyncaudiodelay !== undefined)
      attrs.push(`videosyncaudiodelay="${params.videosyncaudiodelay}"`);
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
      if (!aptc) throw new Error("Missing <audioproducttonecontrols> element");
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
    if (params.bass) parts.push(`<bass value="${params.bass.value}" />`);
    if (params.treble) parts.push(`<treble value="${params.treble.value}" />`);
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
      if (!aplc) throw new Error("Missing <audioproductlevelcontrols> element");
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
    if (params.frontCenterSpeakerLevel)
      parts.push(
        `<frontCenterSpeakerLevel value="${params.frontCenterSpeakerLevel.value}" />`,
      );
    if (params.rearSurroundSpeakersLevel)
      parts.push(
        `<rearSurroundSpeakersLevel value="${params.rearSurroundSpeakersLevel.value}" />`,
      );
    const xml = `<audioproductlevelcontrols>${parts.join("")}</audioproductlevelcontrols>`;
    return this.post("/audioproductlevelcontrols", xml);
  }
}

function parseNowPlaying(root: XmlNode): NowPlayingResponse {
  const np = root.name === "nowPlaying" ? root : getChild(root, "nowPlaying");
  if (!np) throw new Error("Missing <nowPlaying> element");
  const art = getChild(np, "art");
  return {
    deviceID: np.attributes.deviceID ?? "",
    source: np.attributes.source ?? "",
    contentItem: parseContentItem(getChild(np, "ContentItem")!),
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

function parseContentItem(node: XmlNode) {
  return {
    source: node.attributes.source ?? "",
    location: node.attributes.location ?? "",
    sourceAccount: node.attributes.sourceAccount ?? "",
    isPresetable: parseBool(node.attributes.isPresetable ?? "false"),
    itemName: getChildText(node, "itemName") ?? "",
  };
}

function parseToneControl(node: XmlNode | undefined) {
  if (!node) return { value: 0, minValue: 0, maxValue: 0, step: 0 };
  return {
    value: parseIntSafe(node.attributes.value ?? "0"),
    minValue: parseIntSafe(node.attributes.minValue ?? "0"),
    maxValue: parseIntSafe(node.attributes.maxValue ?? "0"),
    step: parseIntSafe(node.attributes.step ?? "0"),
  };
}

function parseLevelControl(node: XmlNode | undefined) {
  if (!node) return { value: 0, minValue: 0, maxValue: 0, step: 0 };
  return {
    value: parseIntSafe(node.attributes.value ?? "0"),
    minValue: parseIntSafe(node.attributes.minValue ?? "0"),
    maxValue: parseIntSafe(node.attributes.maxValue ?? "0"),
    step: parseIntSafe(node.attributes.step ?? "0"),
  };
}

function tryParseApiErrors(body: string): ApiError | null {
  try {
    const root = parseXml(body);
    return tryParseApiErrorsFromNode(root);
  } catch {
    return null;
  }
}

function tryParseApiErrorsFromNode(root: XmlNode): ApiError | null {
  const errorsRoot = root.name === "errors" ? root : getChild(root, "errors");
  if (!errorsRoot) return null;
  return new ApiError({
    deviceID: errorsRoot.attributes.deviceID ?? "",
    errors: getChildren(errorsRoot, "error").map((e) => ({
      value: parseIntSafe(e.attributes.value ?? "0"),
      name: e.attributes.name ?? "",
      severity: e.attributes.severity ?? "",
      message: e.text,
    })),
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
