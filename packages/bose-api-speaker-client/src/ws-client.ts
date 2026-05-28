import {
  getChild,
  getChildText,
  parseBool,
  parseIntSafe,
  parseXml,
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
      type: "info";
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
      type: "unknown";
      deviceID: string;
    };

function unescapeXml(val: string): string {
  if (!val) {
    return "";
  }
  return val
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function unescapeIf(val: string | undefined): string | undefined {
  return val ? unescapeXml(val) : undefined;
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
    track: np ? unescapeIf(getChildText(np, "track")) : undefined,
    artist: np ? unescapeIf(getChildText(np, "artist")) : undefined,
    album: np ? unescapeIf(getChildText(np, "album")) : undefined,
    artUrl: np ? unescapeIf(getChildText(np, "art")) : undefined,
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
            itemName:
              unescapeIf(getChildText(contentItemNode, "itemName")) ?? "",
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
            itemName:
              unescapeIf(getChildText(contentItemNode, "itemName")) ?? "",
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
  const deviceIDMatch = /<updates[^>]+deviceID="([^"]+)"/.exec(xml);
  if (!deviceIDMatch) {
    return null;
  }

  const deviceID = deviceIDMatch[1];

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
      name: match ? unescapeXml(match[1]) : "",
    };
  }

  if (xml.includes("<infoUpdated") || xml.includes("<info>")) {
    return { type: "info", deviceID };
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

  return { type: "unknown", deviceID };
}

export interface BoseWebSocketClientOptions {
  host: string;
  deviceID: string;
  onUpdate: (update: BoseWSUpdate) => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

export class BoseWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly options: BoseWebSocketClientOptions;
  private isClosedIntentional = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  // 22 attempts ~ 5 minutes total
  private readonly maxReconnectAttempts = 22;

  constructor(options: BoseWebSocketClientOptions) {
    this.options = options;
  }

  getHost(): string {
    return this.options.host;
  }

  updateHost(host: string) {
    if (this.options.host !== host) {
      this.options.host = host;
      // Force connection reset to connect to new host IP
      this.connect();
    }
  }

  isClosed(): boolean {
    return this.ws === null || this.ws.readyState === WebSocket.CLOSED;
  }

  connect() {
    this.close(true);
    this.isClosedIntentional = false;

    const wsUrl = `ws://${this.options.host}:8080`;
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
      };

      this.ws.onmessage = (event) => {
        const data: unknown = event.data;
        if (typeof data === "string") {
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
