import { Err, Ok, type Result } from "better-result";

import { type BoseApiError, NetworkError, XmlParseError } from "./errors.ts";
import {
  escapeXml,
  parseGroupNode,
  tryParseApiErrorsFromNode,
} from "./http-adapter.ts";
import type { SpeakerGroup } from "./types/index.ts";
import {
  decodeXmlEntities,
  getChild,
  getChildText,
  parseBool,
  parseIntSafe,
  parseXml,
  type XmlNode,
} from "./xml-parser.ts";

export interface BoseNowPlaying {
  deviceID: string;
  source: string;
  playStatus: string;
  track?: string;
  artist?: string;
  album?: string;
  artUrl?: string;
}

export interface BoseVolume {
  deviceID: string;
  targetVolume: number;
  actualVolume: number;
  muteEnabled: boolean;
}

export interface BoseConnectionState {
  deviceID: string;
  state: string;
  up: boolean;
  signal: string;
}

export interface BoseNowSelection {
  deviceID: string;
  preset: {
    id: number;
    contentItem?: {
      source: string;
      location: string;
      sourceAccount: string;
      isPresetable: boolean;
      itemName: string;
    };
  };
}

export interface BoseRecent {
  deviceID: string;
  utcTime: number;
  contentItem?: {
    source: string;
    type?: string;
    location: string;
    sourceAccount: string;
    isPresetable: boolean;
    itemName: string;
  };
}

export interface BoseRecents {
  deviceID: string;
  recents: BoseRecent[];
}

export type BoseWSUpdate =
  | {
      type: "volume";
      deviceID: string;
      volume?: BoseVolume;
    }
  | {
      type: "nowPlaying";
      deviceID: string;
      nowPlaying?: BoseNowPlaying;
    }
  | {
      type: "connectionState";
      deviceID: string;
      connectionState?: BoseConnectionState;
    }
  | {
      type: "nowSelection";
      deviceID: string;
      nowSelection?: BoseNowSelection;
    }
  | {
      type: "presets";
      deviceID: string;
    }
  | {
      type: "zone";
      deviceID: string;
    }
  | {
      /** The stereo pair changed (`groupUpdated`); `null` once dissolved. */
      type: "group";
      deviceID: string;
      group: SpeakerGroup | null;
    }
  | {
      /** The pair's balance changed (`balanceUpdated`); read `/balance`. */
      type: "balance";
      deviceID: string;
    }
  | {
      type: "info";
      deviceID: string;
    }
  | {
      /** The speaker's sources changed (`sourcesUpdated`). */
      type: "sources";
      deviceID: string;
    }
  | {
      type: "nameUpdated";
      deviceID: string;
      name: string;
    }
  | {
      type: "recents";
      deviceID: string;
      recents?: BoseRecents;
    }
  | {
      type: "siteSurveyResults";
      deviceID: string;
    }
  | {
      type: "unknown";
      deviceID: string;
    };

/** `parseXml` already decoded entities; this only maps empty text to unset. */
function nonEmpty(val: string | undefined): string | undefined {
  return val === "" ? undefined : val;
}

function parseVolumeResponse(xml: string): BoseVolume {
  const root = parseXml(xml);
  const vol = root.name === "volume" ? root : getChild(root, "volume");
  return {
    deviceID: vol?.attributes.deviceID ?? "",
    targetVolume: parseIntSafe(
      (vol && getChildText(vol, "targetvolume")) ?? "0",
    ),
    actualVolume: parseIntSafe(
      (vol && getChildText(vol, "actualvolume")) ?? "0",
    ),
    muteEnabled: parseBool(
      (vol && getChildText(vol, "muteenabled")) ?? "false",
    ),
  };
}

function parseConnectionStateUpdated(xml: string): BoseConnectionState {
  const root = parseXml(xml);
  const node =
    root.name === "connectionStateUpdated"
      ? root
      : getChild(root, "connectionStateUpdated");
  return {
    deviceID: "",
    state: node?.attributes.state ?? "",
    up: parseBool(node?.attributes.up ?? "false"),
    signal: node?.attributes.signal ?? "",
  };
}

function parseNowPlayingResponse(xml: string): BoseNowPlaying {
  const root = parseXml(xml);
  const np = root.name === "nowPlaying" ? root : getChild(root, "nowPlaying");
  return {
    deviceID: np?.attributes.deviceID ?? "",
    source: np?.attributes.source ?? "STANDBY",
    playStatus: (np && getChildText(np, "playStatus")) ?? "STANDBY",
    track: np ? nonEmpty(getChildText(np, "track")) : undefined,
    artist: np ? nonEmpty(getChildText(np, "artist")) : undefined,
    album: np ? nonEmpty(getChildText(np, "album")) : undefined,
    artUrl: np ? nonEmpty(getChildText(np, "art")) : undefined,
  };
}

function parseNowSelectionUpdated(xml: string): BoseNowSelection {
  const root = parseXml(xml);
  const node =
    root.name === "nowSelectionUpdated"
      ? root
      : getChild(root, "nowSelectionUpdated");
  const presetNode = node ? getChild(node, "preset") : undefined;
  const contentItemNode = presetNode
    ? getChild(presetNode, "ContentItem")
    : undefined;

  return {
    deviceID: "",
    preset: {
      id: parseIntSafe(presetNode?.attributes.id ?? "0"),
      contentItem: contentItemNode
        ? {
            source: contentItemNode.attributes.source ?? "",
            location: contentItemNode.attributes.location ?? "",
            sourceAccount: contentItemNode.attributes.sourceAccount ?? "",
            isPresetable: parseBool(
              contentItemNode.attributes.isPresetable ?? "false",
            ),
            itemName: nonEmpty(getChildText(contentItemNode, "itemName")) ?? "",
          }
        : undefined,
    },
  };
}

function parseRecentsUpdated(xml: string): BoseRecents {
  const root = parseXml(xml);
  let recentsNode = root.name === "recents" ? root : getChild(root, "recents");
  if (!recentsNode && root.name === "recentsUpdated") {
    recentsNode = getChild(root, "recents");
  }

  const recentNodes = recentsNode
    ? (recentsNode.children ?? []).filter((child) => child.name === "recent")
    : [];

  const recents: BoseRecent[] = recentNodes.map((recentNode) => {
    const contentItemNode =
      getChild(recentNode, "contentItem") ??
      getChild(recentNode, "ContentItem");

    return {
      deviceID: recentNode.attributes.deviceID ?? "",
      utcTime: parseIntSafe(recentNode.attributes.utcTime ?? "0"),
      contentItem: contentItemNode
        ? {
            source: contentItemNode.attributes.source ?? "",
            type: contentItemNode.attributes.type,
            location: contentItemNode.attributes.location ?? "",
            sourceAccount: contentItemNode.attributes.sourceAccount ?? "",
            isPresetable: parseBool(
              contentItemNode.attributes.isPresetable ?? "false",
            ),
            itemName: nonEmpty(getChildText(contentItemNode, "itemName")) ?? "",
          }
        : undefined,
    };
  });

  return {
    deviceID: "",
    recents,
  };
}

export function parseWebSocketMessage(xml: string): BoseWSUpdate | null {
  // `groupUpdated` and `balanceUpdated` quote the attribute with `'`.
  const deviceIDMatch = /<updates[^>]+deviceID=(?:"([^"]+)"|'([^']+)')/.exec(
    xml,
  );
  if (!deviceIDMatch) {
    return null;
  }

  const deviceID = deviceIDMatch[1] ?? deviceIDMatch[2];

  if (xml.includes("<groupUpdated")) {
    // The teardown frame carries `<group />`, which this does not match.
    const block = /<group(?:\s[^>]*)?>[\s\S]*?<\/group>/.exec(xml);
    return {
      type: "group",
      deviceID,
      group: block ? parseGroupNode(parseXml(block[0])) : null,
    };
  }

  if (xml.includes("<balanceUpdated")) {
    return { type: "balance", deviceID };
  }

  if (xml.includes("<volumeUpdated") || xml.includes("<volume>")) {
    const volumeBlock = /<volume[\s\S]*?<\/volume>/.exec(xml);
    if (volumeBlock) {
      const volume = parseVolumeResponse(volumeBlock[0]);
      volume.deviceID = deviceID;
      return { type: "volume", deviceID, volume };
    }
    return { type: "volume", deviceID };
  }

  if (xml.includes("<nowPlayingUpdated") || xml.includes("<nowPlaying>")) {
    const nowPlayingBlock = /<nowPlaying[\s\S]*?<\/nowPlaying>/.exec(xml);
    if (nowPlayingBlock) {
      const nowPlaying = parseNowPlayingResponse(nowPlayingBlock[0]);
      nowPlaying.deviceID = deviceID;
      return { type: "nowPlaying", deviceID, nowPlaying };
    }
    return { type: "nowPlaying", deviceID };
  }

  if (xml.includes("<connectionStateUpdated")) {
    const block = /<connectionStateUpdated[\s\S]*?\/>/.exec(xml);
    if (block) {
      const connectionState = parseConnectionStateUpdated(block[0]);
      connectionState.deviceID = deviceID;
      return { type: "connectionState", deviceID, connectionState };
    }
    return { type: "connectionState", deviceID };
  }

  if (xml.includes("<nowSelectionUpdated")) {
    const block = /<nowSelectionUpdated[\s\S]*?<\/nowSelectionUpdated>/.exec(
      xml,
    );
    if (block) {
      const nowSelection = parseNowSelectionUpdated(block[0]);
      nowSelection.deviceID = deviceID;
      return { type: "nowSelection", deviceID, nowSelection };
    }
    return { type: "nowSelection", deviceID };
  }

  if (xml.includes("<presetsUpdated") || xml.includes("<presets>")) {
    return { type: "presets", deviceID };
  }

  if (xml.includes("<zoneUpdated") || xml.includes("<zone>")) {
    return { type: "zone", deviceID };
  }

  if (xml.includes("<nameUpdated>")) {
    const match = /<nameUpdated>([\s\S]*?)<\/nameUpdated>/.exec(xml);
    return {
      type: "nameUpdated",
      deviceID,
      name: match ? decodeXmlEntities(match[1]) : "",
    };
  }

  if (xml.includes("<infoUpdated") || xml.includes("<info>")) {
    return { type: "info", deviceID };
  }

  if (xml.includes("<sourcesUpdated")) {
    return { type: "sources", deviceID };
  }

  if (xml.includes("<recentsUpdated") || xml.includes("<recents>")) {
    const block = /<recents[\s\S]*?<\/recents>/.exec(xml);
    if (block) {
      const recents = parseRecentsUpdated(block[0]);
      recents.deviceID = deviceID;
      return { type: "recents", deviceID, recents };
    }
    return { type: "recents", deviceID };
  }

  if (
    xml.includes("<siteSurveyResultsUpdated") ||
    xml.includes("<siteSurveyResults>")
  ) {
    return { type: "siteSurveyResults", deviceID };
  }

  return { type: "unknown", deviceID };
}

export interface BoseWebSocketClientOptions {
  host: string;
  /** Default 8080. */
  port?: number;
  deviceID: string;
  onUpdate: (update: BoseWSUpdate) => void;
  /** The socket opened, at first and after each reconnect. */
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * A request sent over the socket, as the speaker's own app does; some
 * settings can only be written this way (the balance: `POST /balance` never
 * answers).
 */
export interface BoseWSRequest {
  /** The endpoint, without its leading slash: `"balance"`. */
  url: string;
  method: "GET" | "POST";
  /** `<info mainNode>`, which some writes need (`"balanceSet"`). */
  mainNode?: string;
  /** XML to put in `<body>`. */
  body?: string;
  /** How long to wait for the reply; default 5 s. */
  timeoutMs?: number;
}

/** The speaker normally replies within 100 ms. */
const REQUEST_TIMEOUT_MS = 5000;

/** `WebSocket.OPEN`; the global's static isn't read, since it can be replaced. */
const OPEN = 1;

/** A `<msg>` frame: a reply to a request, or a request of the speaker's own. */
const MSG_FRAME = /^\s*(?:<\?xml[^>]*\?>\s*)?<msg[\s>]/;

/** A reply's `<body>`, and the frame it came in. */
interface WSReply {
  body: XmlNode;
  raw: string;
}

export class BoseWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly options: BoseWebSocketClientOptions;
  private isClosedIntentional = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  // 22 attempts ~ 5 minutes total
  private readonly maxReconnectAttempts = 22;
  private lastRequestID = 0;
  /** Settles each request awaiting its reply, by requestID. */
  private readonly pendingRequests = new Map<
    string,
    (result: Result<WSReply, BoseApiError>) => void
  >();

  constructor(options: BoseWebSocketClientOptions) {
    this.options = options;
  }

  getHost(): string {
    return this.options.host;
  }

  updateHost(host: string) {
    if (this.options.host !== host) {
      this.options.host = host;
      this.reconnectAttempts = 0;
      // Force connection reset to connect to new host IP
      this.connect();
    }
  }

  /**
   * Sends `request` and resolves with `parse` applied to its reply's
   * `<body>` (empty when the reply has none): an ApiError when the speaker
   * refused it, an XmlParseError when `parse` throws, a NetworkError when the
   * socket isn't open, closes first, or no reply comes in time.
   * Notifications keep going to `onUpdate` meanwhile.
   */
  async request<TParsed>(
    request: BoseWSRequest,
    parse: (body: XmlNode) => TParsed,
  ): Promise<Result<TParsed, BoseApiError>> {
    const ws = this.ws;
    if (ws === null || ws.readyState !== OPEN) {
      return new Err(
        new NetworkError({
          message: `The WebSocket to ${this.options.deviceID} isn't open`,
        }),
      );
    }

    this.lastRequestID += 1;
    const requestID = String(this.lastRequestID);
    const info =
      request.mainNode === undefined
        ? `<info type="new"/>`
        : `<info mainNode="${escapeXml(request.mainNode)}" type="new"/>`;
    const frame = `<msg><header deviceID="${escapeXml(this.options.deviceID)}" url="${escapeXml(request.url)}" method="${request.method}"><request requestID="${requestID}">${info}</request></header><body>${request.body ?? ""}</body></msg>`;

    const reply = await new Promise<Result<WSReply, BoseApiError>>(
      (resolve) => {
        const timeout = setTimeout(() => {
          settle(
            new Err(
              new NetworkError({
                message: `${this.options.deviceID} didn't reply to ${request.method} ${request.url}`,
              }),
            ),
          );
        }, request.timeoutMs ?? REQUEST_TIMEOUT_MS);
        const settle = (result: Result<WSReply, BoseApiError>) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestID);
          resolve(result);
        };
        this.pendingRequests.set(requestID, settle);

        try {
          ws.send(frame);
        } catch (error) {
          settle(
            new Err(
              new NetworkError({
                message: error instanceof Error ? error.message : String(error),
                cause: error,
              }),
            ),
          );
        }
      },
    );
    if (reply.isErr()) {
      return new Err(reply.error);
    }
    try {
      return new Ok(parse(reply.value.body));
    } catch (shapeError) {
      return new Err(
        new XmlParseError({
          message:
            shapeError instanceof Error
              ? shapeError.message
              : String(shapeError),
          rawXml: reply.value.raw,
        }),
      );
    }
  }

  /**
   * Settles the request `data` replies to; false for any other frame. A
   * reply echoes its request's requestID with `msgType="RESPONSE"`.
   */
  private settleReply(data: string): boolean {
    if (!MSG_FRAME.test(data)) {
      return false;
    }
    let msg: XmlNode;
    try {
      msg = parseXml(data);
    } catch {
      return false;
    }
    const header = getChild(msg, "header");
    const request = header && getChild(header, "request");
    if (request?.attributes.msgType !== "RESPONSE") {
      return false;
    }
    const settle = this.pendingRequests.get(request.attributes.requestID ?? "");
    if (!settle) {
      // A late reply, to a request that already timed out.
      return true;
    }
    const body = getChild(msg, "body") ?? {
      name: "body",
      attributes: {},
      children: [],
      text: "",
    };
    const refused = tryParseApiErrorsFromNode(body, data);
    settle(refused ? new Err(refused) : new Ok({ body, raw: data }));
    return true;
  }

  /** The socket closed: no request on it can get its reply. */
  private failPendingRequests() {
    for (const settle of [...this.pendingRequests.values()]) {
      settle(
        new Err(
          new NetworkError({
            message: `The WebSocket to ${this.options.deviceID} closed`,
          }),
        ),
      );
    }
  }

  isClosed(): boolean {
    return this.ws === null || this.ws.readyState === WebSocket.CLOSED;
  }

  connect() {
    this.close(true);
    this.isClosedIntentional = false;

    const wsUrl = `ws://${this.options.host}:${this.options.port ?? 8080}`;
    console.log(
      `[BoseWebSocketClient] Connecting to ${wsUrl} (deviceID: ${this.options.deviceID})`,
    );

    try {
      this.ws = new WebSocket(wsUrl, "gabbo");

      this.ws.onopen = () => {
        console.log(
          `[BoseWebSocketClient] Connected to ${this.options.deviceID}`,
        );
        this.reconnectAttempts = 0;
        this.options.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        const data: unknown = event.data;
        if (typeof data === "string") {
          if (this.settleReply(data)) {
            return;
          }
          try {
            const update = parseWebSocketMessage(data);
            if (update) {
              if (update.type === "unknown") {
                console.log(
                  `[BoseWebSocketClient] Unknown notification (${this.options.deviceID}):`,
                  data,
                );
              }
              this.options.onUpdate(update);
            }
          } catch (err) {
            console.warn(
              `[BoseWebSocketClient] Failed to parse message for ${this.options.deviceID}:`,
              err,
            );
          }
        }
      };

      this.ws.onerror = (error) => {
        console.warn(
          `[BoseWebSocketClient] Error on connection for ${this.options.deviceID}:`,
          error,
        );
        if (this.options.onError) {
          this.options.onError(error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(
          `[BoseWebSocketClient] Connection closed for ${this.options.deviceID} (code: ${event.code})`,
        );
        this.failPendingRequests();
        if (!this.isClosedIntentional) {
          if (this.options.onDisconnect) {
            this.options.onDisconnect();
          }
          this.attemptReconnect();
        }
      };
    } catch (err) {
      console.error(
        `[BoseWebSocketClient] Exception when connecting to ${wsUrl}:`,
        err,
      );
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(
        `[BoseWebSocketClient] Max reconnect attempts (${this.maxReconnectAttempts}) reached for ${this.options.deviceID}`,
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
    console.log(
      `[BoseWebSocketClient] Reconnecting to ${this.options.deviceID} in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  close(intentional = true) {
    this.isClosedIntentional = intentional;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.failPendingRequests();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }
}
