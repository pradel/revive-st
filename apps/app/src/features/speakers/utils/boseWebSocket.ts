import {
  parseNowPlayingResponse,
  parseVolumeResponse,
  BoseNowPlaying,
  BoseVolume,
} from "./boseParser";

export interface BoseWSUpdate {
  deviceID: string;
  type: "volume" | "nowPlaying" | "presets" | "zone" | "info" | "unknown";
  volume?: BoseVolume;
  nowPlaying?: BoseNowPlaying;
}

export function parseWebSocketMessage(xml: string): BoseWSUpdate | null {
  const deviceIDMatch = xml.match(/<updates[^>]+deviceID="([^"]+)"/);
  if (!deviceIDMatch) return null;

  const deviceID = deviceIDMatch[1];
  let type: BoseWSUpdate["type"] = "unknown";
  let volume: BoseVolume | undefined;
  let nowPlaying: BoseNowPlaying | undefined;

  // Check for Volume updates
  if (xml.includes("<volumeUpdated") || xml.includes("<volume>")) {
    type = "volume";
    const volumeBlock = xml.match(/<volume[\s\S]*?<\/volume>/);
    if (volumeBlock) {
      volume = parseVolumeResponse(volumeBlock[0]);
      volume.deviceID = deviceID; // Ensure deviceID is correct
    }
  }
  // Check for NowPlaying updates
  else if (xml.includes("<nowPlayingUpdated") || xml.includes("<nowPlaying>")) {
    type = "nowPlaying";
    const nowPlayingBlock = xml.match(/<nowPlaying[\s\S]*?<\/nowPlaying>/);
    if (nowPlayingBlock) {
      nowPlaying = parseNowPlayingResponse(nowPlayingBlock[0]);
      nowPlaying.deviceID = deviceID; // Ensure deviceID is correct
    }
  }
  // Check for Presets updates
  else if (xml.includes("<presetsUpdated") || xml.includes("<presets>")) {
    type = "presets";
  }
  // Check for Zone updates
  else if (xml.includes("<zoneUpdated") || xml.includes("<zone>")) {
    type = "zone";
  }
  // Check for Info updates (e.g. device renamed)
  else if (xml.includes("<infoUpdated") || xml.includes("<info>")) {
    type = "info";
  }

  return {
    deviceID,
    type,
    volume,
    nowPlaying,
  };
}

export interface BoseWSClientOptions {
  host: string;
  deviceID: string;
  onUpdate: (update: BoseWSUpdate) => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export class BoseWSClient {
  private ws: WebSocket | null = null;
  private options: BoseWSClientOptions;
  private isClosedIntentional = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(options: BoseWSClientOptions) {
    this.options = options;
  }

  connect() {
    this.close(true); // Ensure any previous connection is closed
    this.isClosedIntentional = false;

    const wsUrl = `ws://${this.options.host}:8080`;
    console.log(
      `[BoseWSClient] Connecting to ${wsUrl} (deviceID: ${this.options.deviceID})`,
    );

    try {
      // SoundTouch WebSocket requires protocol "gabbo"
      this.ws = new WebSocket(wsUrl, "gabbo");

      this.ws.onopen = () => {
        console.log(`[BoseWSClient] Connected to ${this.options.deviceID}`);
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        const data = event.data;
        if (typeof data === "string") {
          try {
            const update = parseWebSocketMessage(data);
            if (update) {
              this.options.onUpdate(update);
            }
          } catch (err) {
            console.warn(
              `[BoseWSClient] Failed to parse message for ${this.options.deviceID}:`,
              err,
            );
          }
        }
      };

      this.ws.onerror = (error) => {
        console.warn(
          `[BoseWSClient] Error on connection for ${this.options.deviceID}:`,
          error,
        );
        if (this.options.onError) {
          this.options.onError(error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(
          `[BoseWSClient] Connection closed for ${this.options.deviceID} (code: ${event.code})`,
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
        `[BoseWSClient] Exception when connecting to ${wsUrl}:`,
        err,
      );
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(
        `[BoseWSClient] Max reconnect attempts (${this.maxReconnectAttempts}) reached for ${this.options.deviceID}`,
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff up to 10s
    console.log(
      `[BoseWSClient] Reconnecting to ${this.options.deviceID} in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
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
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }
}
