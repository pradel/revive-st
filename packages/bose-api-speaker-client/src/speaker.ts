import { Err, Ok, type Result } from "better-result";

import type { BoseApiError } from "./errors.ts";
import { BoseHttpAdapter } from "./http-adapter.ts";
import type {
  ZoneMember,
  AudioDspControlsResponse,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  BassCapabilitiesResponse,
  CapabilitiesResponse,
  DeviceComponent,
  Preset,
  AudioMode,
  KeyValue,
} from "./types/index.ts";
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

  // Static or rarely changed profile data
  name?: string;
  type?: string;
  presets?: Preset[];
  bass?: number;
  bassCapabilities?: BassCapabilitiesResponse | null;
  capabilities?: CapabilitiesResponse | null;
  audioDspControls?: AudioDspControlsResponse | null;
  audioProductToneControls?: AudioProductToneControlsResponse | null;
  audioProductLevelControls?: AudioProductLevelControlsResponse | null;
  components?: DeviceComponent[];
  macAddress?: string;
}

export class Speaker {
  private readonly http: BoseHttpAdapter;
  private ws: BoseWebSocketClient | null = null;
  private readonly state: SpeakerState;
  public readonly options: SpeakerOptions;

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
   * Initialize the speaker state by fetching all its static and current dynamic info.
   */
  async initialize(): Promise<Result<void, BoseApiError>> {
    const infoResult = await this.http.getInfo();
    if (infoResult.isOk()) {
      const info = infoResult.value;
      this.state.name = info.name;
      this.state.type = info.type;
      this.state.components = info.components;
      this.state.macAddress = info.networkInfo?.macAddress;
    }

    try {
      const [
        nowPlaying,
        volumeInfo,
        presetsResult,
        bassResult,
        bassCaps,
        capabilities,
        dspControls,
        toneControls,
        levelControls,
      ] = await Promise.all([
        this.http
          .getNowPlaying()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getVolume()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getPresets()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getBass()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getBassCapabilities()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getCapabilities()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getAudioDspControls()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getAudioProductToneControls()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
        this.http
          .getAudioProductLevelControls()
          .then((res) => (res.isOk() ? res.value : null))
          .catch(() => null),
      ]);

      if (nowPlaying) {
        this.state.nowPlaying = {
          source: nowPlaying.source,
          playStatus: nowPlaying.playStatus,
          track: nowPlaying.track,
          artist: nowPlaying.artist,
          album: nowPlaying.album,
          artUrl: nowPlaying.art?.url,
        };
        this.state.powerState =
          nowPlaying.source === "STANDBY" ? "standby" : "on";
      }

      if (volumeInfo) {
        this.state.volume = volumeInfo.actualvolume;
        this.state.isMuted = volumeInfo.muteenabled;
      }

      if (presetsResult) {
        this.state.presets = presetsResult.presets;
      }
      if (bassResult) {
        this.state.bass = bassResult.actualbass;
      }
      if (bassCaps) {
        this.state.bassCapabilities = bassCaps;
      }
      if (capabilities) {
        this.state.capabilities = capabilities;
      }
      if (dspControls) {
        this.state.audioDspControls = dspControls;
      }
      if (toneControls) {
        this.state.audioProductToneControls = toneControls;
      }
      if (levelControls) {
        this.state.audioProductLevelControls = levelControls;
      }

      this.emitState();
      return new Ok(undefined);
    } catch (e) {
      return new Err(e as BoseApiError);
    }
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
    return structuredClone(this.state);
  }

  // --- Domain Actions ---

  async play(): Promise<Result<void, BoseApiError>> {
    return this.triggerKey("PLAY");
  }

  async pause(): Promise<Result<void, BoseApiError>> {
    return this.triggerKey("PAUSE");
  }

  async playPause(): Promise<Result<void, BoseApiError>> {
    if (this.state.nowPlaying?.playStatus === "PLAY_STATE") {
      return this.triggerKey("PAUSE");
    }
    return this.triggerKey("PLAY");
  }

  async stop(): Promise<Result<void, BoseApiError>> {
    return this.triggerKey("STOP");
  }

  async skip(): Promise<Result<void, BoseApiError>> {
    return this.triggerKey("NEXT_TRACK");
  }

  async previous(): Promise<Result<void, BoseApiError>> {
    return this.triggerKey("PREV_TRACK");
  }

  async playPreset(
    id: 1 | 2 | 3 | 4 | 5 | 6,
  ): Promise<Result<void, BoseApiError>> {
    const key = `PRESET_${id}` as KeyValue;
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

  async powerToggle(): Promise<Result<void, BoseApiError>> {
    return this.triggerKey("POWER");
  }

  async triggerKey(key: KeyValue): Promise<Result<void, BoseApiError>> {
    const res = await this.http.pressKey({
      key,
      state: "press",
      sender: "bose-client",
    });
    if (!res.isOk()) {
      return res;
    }
    return this.http.pressKey({ key, state: "release", sender: "bose-client" });
  }

  async selectSource(
    source: string,
    sourceAccount?: string,
  ): Promise<Result<void, BoseApiError>> {
    return this.http.selectSource({ source, sourceAccount });
  }

  async setBass(value: number): Promise<Result<void, BoseApiError>> {
    return this.http.setBass(value);
  }

  async setName(name: string): Promise<Result<void, BoseApiError>> {
    return this.http.setName(name);
  }

  async setAudioDspControls(
    audiomode: AudioMode,
  ): Promise<Result<void, BoseApiError>> {
    return this.http.setAudioDspControls({ audiomode });
  }

  async setAudioProductToneControls(opts: {
    bass?: { value: number };
    treble?: { value: number };
  }): Promise<Result<void, BoseApiError>> {
    return this.http.setAudioProductToneControls(opts);
  }

  async setAudioProductLevelControls(opts: {
    frontCenterSpeakerLevel?: { value: number };
    rearSurroundSpeakersLevel?: { value: number };
  }): Promise<Result<void, BoseApiError>> {
    return this.http.setAudioProductLevelControls(opts);
  }

  async savePreset(
    id: 1 | 2 | 3 | 4 | 5 | 6,
  ): Promise<Result<void, BoseApiError>> {
    const key = `PRESET_${id}` as KeyValue;
    const res = await this.http.pressKey({
      key,
      state: "press",
      sender: "bose-client",
    });
    if (!res.isOk()) {
      return res;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return this.http.pressKey({ key, state: "release", sender: "bose-client" });
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
    } else if (update.type === "nameUpdated" && update.name) {
      if (this.state.name !== update.name) {
        this.state.name = update.name;
        stateChanged = true;
      }
    } else if (
      update.type === "nowSelection" &&
      update.nowSelection?.preset?.contentItem
    ) {
      const contentItem = update.nowSelection.preset.contentItem;
      this.state.nowPlaying = {
        source: contentItem.source,
        track: contentItem.itemName,
        playStatus: "BUFFERING_STATE",
        artist: undefined,
        album: undefined,
        artUrl: undefined,
      };
      stateChanged = true;
    } else if (update.type === "presets") {
      // For presets update, we might want to refresh from HTTP since WS doesn't send the full list in the same format always.
      // But actually, WS does not send the full preset list payload.
      // Typically we'd fetch HTTP. But we can just emit an event to refresh if needed.
    }

    if (stateChanged) {
      this.emitState();
    }
  }

  private emitState() {
    if (this.options.onStateUpdate) {
      this.options.onStateUpdate(structuredClone(this.state));
    }
  }
}
