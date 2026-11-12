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
  ContentItem,
  DeviceComponent,
  Preset,
  AudioMode,
  KeyValue,
  NewGroup,
  RequestOptions,
  SpeakerGroup,
} from "./types/index.ts";
import { BoseWebSocketClient, type BoseWSUpdate } from "./ws-adapter.ts";

/** How long `initialize()` waits for `/getGroup`. */
const GROUP_READ_TIMEOUT_MS = 3000;

/** `/info` types of the SoundTouch 10, the only model that pairs in stereo. */
const SOUNDTOUCH_10_TYPE = /soundtouch 10\b|\bst10\b/i;

export interface SpeakerOptions {
  ip: string;
  port?: number;
  deviceID: string;
  onStateUpdate?: (state: SpeakerState) => void;
  /**
   * The speaker says its info (name, account, Marge server) or its sources
   * changed; the new values have to be read again.
   */
  onSettingsChange?: () => void;
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
  /** The Marge account the speaker is paired with; empty when unpaired. */
  margeAccountUUID?: string;
  /** The Marge server the speaker calls. */
  margeURL?: string;
  /**
   * The stereo pair the speaker is in, `null` when unpaired; unset when not
   * read (only SoundTouch 10s can pair) or the read failed.
   */
  group?: SpeakerGroup | null;
}

export class Speaker {
  private readonly http: BoseHttpAdapter;
  private ws: BoseWebSocketClient | null = null;
  private readonly state: SpeakerState;
  public readonly options: SpeakerOptions;
  /** Bumped by each `initialize()`; only the latest call may apply its reads. */
  private initializeGeneration = 0;

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
   * When calls overlap, only the latest one applies its results and emits state;
   * an earlier call that resolves later is discarded, so it can't overwrite
   * fresher state.
   */
  async initialize(): Promise<Result<void, BoseApiError>> {
    const generation = ++this.initializeGeneration;

    const infoResult = await this.http.getInfo();
    if (generation !== this.initializeGeneration) {
      return new Ok(undefined);
    }
    if (infoResult.isOk()) {
      const info = infoResult.value;
      this.state.name = info.name;
      this.state.type = info.type;
      this.state.components = info.components;
      this.state.macAddress = info.networkInfo?.macAddress;
      this.state.margeAccountUUID = info.margeAccountUUID;
      this.state.margeURL = info.margeURL;
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
        groupRead,
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
        // Only a SoundTouch 10 answers `/getGroup` (other models hang), and
        // even it is bounded so a stalled speaker can't hold this up.
        SOUNDTOUCH_10_TYPE.test(this.state.type ?? "")
          ? this.http
              .getGroup({ signal: AbortSignal.timeout(GROUP_READ_TIMEOUT_MS) })
              .then((res) => (res.isOk() ? { group: res.value } : null))
              .catch(() => null)
          : null,
      ]);

      if (generation !== this.initializeGeneration) {
        return new Ok(undefined);
      }
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
      if (groupRead) {
        this.state.group = groupRead.group;
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
      onConnect: () => {
        // After a drop, notifications sent while the socket was down were
        // missed: read everything again.
        const reconnected = this.state.connectionState === "disconnected";
        this.state.connectionState = "connected";
        this.emitState();
        if (reconnected) {
          void this.initialize();
        }
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
    return this.http.pressKey({ key, state: "press", sender: "Gabbo" });
  }

  async setVolume(volume: number): Promise<Result<void, BoseApiError>> {
    return this.http.setVolume({ volume });
  }

  async mute(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "MUTE",
      state: "press",
      sender: "Gabbo",
    });
  }

  async powerOn(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "POWER",
      state: "press",
      sender: "Gabbo",
    });
  }

  async powerOff(): Promise<Result<void, BoseApiError>> {
    return this.http.pressKey({
      key: "POWER",
      state: "press",
      sender: "Gabbo",
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
      sender: "Gabbo",
    });
    if (!res.isOk()) {
      return res;
    }
    return this.http.pressKey({ key, state: "release", sender: "Gabbo" });
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

  /**
   * Renames the speaker. On success the new name is in the state right away,
   * without waiting for the speaker's `nameUpdated` event.
   */
  async setName(
    name: string,
    options?: RequestOptions,
  ): Promise<Result<void, BoseApiError>> {
    const result = await this.http.setName(name, options);
    if (result.isOk() && this.state.name !== name) {
      this.state.name = name;
      this.emitState();
    }
    return result;
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
      sender: "Gabbo",
    });
    if (!res.isOk()) {
      return res;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return this.http.pressKey({ key, state: "release", sender: "Gabbo" });
  }

  /** Stores `contentItem` in preset slot `id` without playing it. */
  async storePreset(
    id: 1 | 2 | 3 | 4 | 5 | 6,
    contentItem: ContentItem,
  ): Promise<Result<void, BoseApiError>> {
    return this.http.storePreset(id, contentItem);
  }

  /**
   * Pairs this speaker (the master, LEFT) with another SoundTouch 10. On
   * success the created group is in the state.
   */
  async addGroup(
    group: NewGroup,
    options?: RequestOptions,
  ): Promise<Result<SpeakerGroup | null, BoseApiError>> {
    const result = await this.http.addGroup(group, options);
    if (result.isOk()) {
      this.applyGroup(result.value);
    }
    return result;
  }

  /** Rewrites (renames) the pair; send to the master. */
  async updateGroup(
    group: NewGroup & { id: string },
    options?: RequestOptions,
  ): Promise<Result<SpeakerGroup | null, BoseApiError>> {
    const result = await this.http.updateGroup(group, options);
    if (result.isOk()) {
      this.applyGroup(result.value);
    }
    return result;
  }

  /** Dissolves the pair this speaker is in (both halves). */
  async removeGroup(
    options?: RequestOptions,
  ): Promise<Result<{ peerUnreachable: boolean }, BoseApiError>> {
    const result = await this.http.removeGroup(options);
    if (result.isOk()) {
      this.applyGroup(null);
    }
    return result;
  }

  /** Sets `state.group` and emits the state when it changed. */
  private applyGroup(group: SpeakerGroup | null) {
    if (JSON.stringify(this.state.group) !== JSON.stringify(group)) {
      this.state.group = group;
      this.emitState();
    }
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
    } else if (update.type === "connectionState") {
      // The speaker's own network status, not this socket's: it arrives over
      // an open socket, and one without `up` reads as down. `connectionState`
      // follows the socket alone, as `onConnect` and `onDisconnect` set it.
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
    } else if (update.type === "group") {
      if (JSON.stringify(this.state.group) !== JSON.stringify(update.group)) {
        this.state.group = update.group;
        stateChanged = true;
      }
    } else if (update.type === "info" || update.type === "sources") {
      this.options.onSettingsChange?.();
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
