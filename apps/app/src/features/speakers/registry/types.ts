import type {
  AudioDspControlsResponse,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  BassCapabilitiesResponse,
  CapabilitiesResponse,
  DeviceComponent,
  Preset,
} from "bose-api-speaker-client";

import type { SpeakerServer } from "../lib/server-profiles";

/**
 * `connecting`: a remembered speaker shown from storage while the app tries
 * to reach it; `online`: reached, its state is live; `offline`: it didn't
 * answer at its last address and the network scan hasn't found it.
 */
export type SpeakerStatus = "connecting" | "online" | "offline";

/** Who started a scan: the app (launch, return to foreground) or the user. */
export type ScanKind = "auto" | "user";

/** A listed speaker, as the screens show it. */
export interface BoseSpeaker {
  deviceID: string;
  status: SpeakerStatus;
  host: string;
  port: number;
  name: string;
  type: string;
  /** The server it uses, as last checked; kept across launches. */
  server?: SpeakerServer;
  // What it plays and its settings, as it last showed them; absent until reached.
  playStatus?: string;
  source?: string;
  track?: string;
  artist?: string;
  album?: string;
  artUrl?: string;
  volume?: number;
  muteEnabled?: boolean;
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
}

/** What the speaker list holds at one moment. */
export interface SpeakersSnapshot {
  /** Reached speakers and remembered ones still connecting or offline. */
  readonly listed: readonly BoseSpeaker[];
  /** Reached speakers, the ones commands go to. */
  readonly online: readonly BoseSpeaker[];
  /** The remembered speakers are listed (the first screen can show). */
  readonly restored: boolean;
  readonly scan: ScanKind | null;
  /** Why the last scan stopped early. */
  readonly error: string | null;
}
