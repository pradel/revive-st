import type { Result } from "better-result";

import type { BoseApiError } from "./errors.ts";
import { BoseHttpAdapter } from "./http-adapter.ts";
import type { ZoneMember } from "./types/index.ts";
import { BoseWebSocketClient, type BoseWSUpdate } from "./ws-adapter.ts";

export interface SpeakerOptions {
  ip: string;
  port?: number;
  deviceID: string;
  onStateUpdate?: (state: SpeakerState) => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

export interface SpeakerState {
  volume: number;
  isMuted: boolean;
  nowPlaying?: {
    source: string;
    playStatus: string;
    track?: string;
    artist?: string;
    album?: string;
    artUrl?: string;
  };
  connectionState: "connected" | "disconnected" | "connecting";
  powerState: "on" | "standby";
}

export class Speaker {
  private readonly http: BoseHttpAdapter;
  private ws: BoseWebSocketClient | null = null;
  private readonly state: SpeakerState;
  private readonly options: SpeakerOptions;

  constructor(options: SpeakerOptions) {
    this.options = options;
    this.http = new BoseHttpAdapter({ ip: options.ip, port: options.port });
    this.state = {
      volume: 0,
      isMuted: false,
      connectionState: "disconnected",
      powerState: "standby",
    };
  }

  /**
   * Start listening for state updates via WebSocket.
   */
  connect() {
    if (this.ws) {
      this.ws.close();
    }

    this.state.connectionState = "connecting";
    this.emitState();

    this.ws = new BoseWebSocketClient({
      host: this.options.ip,
      deviceID: this.options.deviceID,
      onUpdate: (update) => {
        this.handleWSUpdate(update);
      },
      onDisconnect: () => {
        this.state.connectionState = "disconnected";
        this.emitState();
        if (this.options.onDisconnect) {
          this.options.onDisconnect();
        }
      },
      onError: (err) => {
        if (this.options.onError) {
          this.options.onError(err);
        }
      },
    });

    this.ws.connect();

    // Assume connected if no immediate error, WS doesn't have an onConnect callback in BoseWebSocketClient,
    // it relies on receiving updates or we can just set it to connected
    this.state.connectionState = "connected";
    this.emitState();
  }

  /**
   * Stop listening for state updates.
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state.connectionState = "disconnected";
    this.emitState();
  }

  /**
   * Get the current state synchronously.
   */
  getState(): SpeakerState {
    return { ...this.state };
  }

  // --- Domain Actions ---

  async play(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "PLAY",
      state: "press",
      sender: "bose-client",
    });
  }

  async pause(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "PAUSE",
      state: "press",
      sender: "bose-client",
    });
  }

  async playPause(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "PLAY_PAUSE",
      state: "press",
      sender: "bose-client",
    });
  }

  async stop(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "STOP",
      state: "press",
      sender: "bose-client",
    });
  }

  async skip(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "NEXT_TRACK",
      state: "press",
      sender: "bose-client",
    });
  }

  async previous(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "PREV_TRACK",
      state: "press",
      sender: "bose-client",
    });
  }

  async playPreset(
    id: 1 | 2 | 3 | 4 | 5 | 6,
  ): Promise<Result<void, BoseApiError>> {
    const key = `PRESET_${id}`;
    return this.http.pressKey({ key, state: "press", sender: "bose-client" });
  }

  async setVolume(volume: number): Promise<Result<void, BoseApiError>> {
    return this.http.setVolume({ volume });
  }

  async mute(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "MUTE",
      state: "press",
      sender: "bose-client",
    });
  }

  async powerOn(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "POWER",
      state: "press",
      sender: "bose-client",
    });
  }

  async powerOff(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "POWER",
      state: "press",
      sender: "bose-client",
    });
  }

  async groupWith(members: ZoneMember[]): Promise<Result<void, BoseApiError>> {
    return this.http.setZone({
      master: this.options.deviceID,
      senderIpAddress: this.options.ip,
      members,
    });
  }

  async ungroup(): Promise<Result<void, BoseApiError>> {
    return this.http.setZone({
      master: this.options.deviceID,
      senderIpAddress: this.options.ip,
      members: [],
    });
  }

  private handleWSUpdate(update: BoseWSUpdate) {
    let stateChanged = false;

    if (update.type === "volume" && update.volume) {
      if (
        this.state.volume !== update.volume.actualVolume ||
        this.state.isMuted !== update.volume.muteEnabled
      ) {
        this.state.volume = update.volume.actualVolume;
        this.state.isMuted = update.volume.muteEnabled;
        stateChanged = true;
      }
    } else if (update.type === "nowPlaying" && update.nowPlaying) {
      const np = update.nowPlaying;

      const newSource = np.source;
      const newPlayStatus = np.playStatus;

      if (
        !this.state.nowPlaying ||
        this.state.nowPlaying.source !== newSource ||
        this.state.nowPlaying.playStatus !== newPlayStatus ||
        this.state.nowPlaying.track !== np.track ||
        this.state.nowPlaying.artist !== np.artist
      ) {
        this.state.nowPlaying = {
          source: newSource,
          playStatus: newPlayStatus,
          track: np.track,
          artist: np.artist,
          album: np.album,
          artUrl: np.artUrl,
        };

        if (newSource === "STANDBY") {
          this.state.powerState = "standby";
        } else {
          this.state.powerState = "on";
        }

        stateChanged = true;
      }
    } else if (update.type === "connectionState" && update.connectionState) {
      const newState = update.connectionState.up ? "connected" : "disconnected";
      if (this.state.connectionState !== newState) {
        this.state.connectionState = newState;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      this.emitState();
    }
  }

  private emitState() {
    if (this.options.onStateUpdate) {
      this.options.onStateUpdate({ ...this.state });
    }
  }
}
