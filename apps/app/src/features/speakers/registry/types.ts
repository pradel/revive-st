import type {
  AudioDspControlsResponse,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  BalanceResponse,
  BassCapabilitiesResponse,
  CapabilitiesResponse,
  DeviceComponent,
  Preset,
} from "bose-api-speaker-client";

import type { RadioStatus } from "../lib/speaker-radio";
import type { SpeakerPair } from "../lib/stereo-pair";

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
  /** What the app calls it: a pair's name for the pair's master. */
  name: string;
  /** The speaker's own name, which its settings rename. */
  speakerName: string;
  type: string;
  /**
   * How it gets internet radio, judged against our server; the last result
   * is kept across launches and while it's checked again.
   */
  radio: RadioStatus;
  /**
   * The stereo pair it's in: as it last reported, remembered across
   * launches. The master's card stands for the pair.
   */
  pair?: SpeakerPair;
  /** The pair's status as the speaker reports it (`GROUP_ERROR`: its partner is gone); only while reached. */
  pairStatus?: string;
  /**
   * The speaker has reported its pair (or that it has none) since it was
   * reached: renaming the pair needs what it reported.
   */
  pairRead?: boolean;
  /**
   * The pair's left/right balance (`balanceAvailable` once the pair plays);
   * `null` when unpaired; unset until read. Only while reached.
   */
  balance?: BalanceResponse | null;
  // What it plays and its settings: only while reached.
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
  /**
   * Reached speakers and remembered ones still connecting or offline; a
   * pair is listed once, as its master.
   */
  readonly listed: readonly BoseSpeaker[];
  /** The listed speakers that are reached. */
  readonly online: readonly BoseSpeaker[];
  /**
   * Every speaker, pairs' partners too: for a partner's own settings, its
   * commands and the household's account.
   */
  readonly all: readonly BoseSpeaker[];
  /** The remembered speakers are listed (the first screen can show). */
  readonly restored: boolean;
  readonly scan: ScanKind | null;
  /** Why the last scan stopped early. */
  readonly error: string | null;
}
