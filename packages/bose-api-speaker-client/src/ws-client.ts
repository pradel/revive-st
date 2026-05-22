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

export function parseWebSocketMessage(xml: string): BoseWSUpdate | null {
  const deviceIDMatch = xml.match(/<updates[^>]+deviceID="([^"]+)"/);
  if (!deviceIDMatch) {
    return null;
  }

  const deviceID = deviceIDMatch[1];

  if (xml.includes("<volumeUpdated") || xml.includes("<volume>")) {
    const volumeBlock = xml.match(/<volume[\s\S]*?<\/volume>/);
    if (volumeBlock) {
      const volume = parseVolumeResponse(volumeBlock[0]);
      volume.deviceID = deviceID;
      return { type: "volume", deviceID, volume };
    }
    return { type: "volume", deviceID };
  }

  if (xml.includes("<nowPlayingUpdated") || xml.includes("<nowPlaying>")) {
    const nowPlayingBlock = xml.match(/<nowPlaying[\s\S]*?<\/nowPlaying>/);
    if (nowPlayingBlock) {
      const nowPlaying = parseNowPlayingResponse(nowPlayingBlock[0]);
      nowPlaying.deviceID = deviceID;
      return { type: "nowPlaying", deviceID, nowPlaying };
    }
    return { type: "nowPlaying", deviceID };
  }

  if (xml.includes("<connectionStateUpdated")) {
    const block = xml.match(/<connectionStateUpdated[\s\S]*?\/>/);
    if (block) {
      const connectionState = parseConnectionStateUpdated(block[0]);
      connectionState.deviceID = deviceID;
      return { type: "connectionState", deviceID, connectionState };
    }
    return { type: "connectionState", deviceID };
  }

  if (xml.includes("<presetsUpdated") || xml.includes("<presets>")) {
    return { type: "presets", deviceID };
  }

  if (xml.includes("<zoneUpdated") || xml.includes("<zone>")) {
    return { type: "zone", deviceID };
  }

  if (xml.includes("<infoUpdated") || xml.includes("<info>")) {
    return { type: "info", deviceID };
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
  private options: BoseWebSocketClientOptions;
  private isClosedIntentional = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(options: BoseWebSocketClientOptions) {
    this.options = options;
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
        const data = event.data;
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
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
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
