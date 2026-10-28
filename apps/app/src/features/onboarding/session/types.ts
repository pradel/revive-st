import type { SetupError } from "./errors";
import type { ScanResult } from "./ports";

export type StepId =
  | "preflight"
  | "findSpeaker"
  | "join"
  | "credentials"
  | "deliver"
  | "leaveSetup"
  | "rejoinHome"
  | "verify"
  | "name";

/** `deviceID` keys `SpeakerManager` and `/speakers/[id]`; `ssid`/`bssid` are the setup network's. */
export interface SpeakerIdentity {
  deviceID: string;
  name: string;
  type: string;
  ssid: string;
  bssid: string;
}

export type Band = "2.4GHz" | "5GHz" | "6GHz";

/** `unsupported`: WEP or enterprise (EAP); the speaker client only sends WPA/WPA2 or open profiles. */
export type Security = "open" | "wpa" | "wpa3" | "unsupported";

export interface HomeNetwork {
  ssid: string;
  /** Bands seen for this SSID, ascending. */
  bands: Band[];
  /** Security of the strongest entry. */
  security: Security;
  /** Strongest RSSI seen for this SSID (dBm). */
  level: number;
}

/**
 * What the step is doing. Only two working views accept an answer: `wifiOff`
 * (`{ kind: "action", action: "openWifiPanel" }` opens the Wi-Fi panel) and
 * every `findSpeaker` view (`{ kind: "action", action: "manualJoin" }` stops
 * scanning and shows the `manualJoin` prompt).
 */
export type WorkingDetail =
  | { kind: "starting" }
  | { kind: "checkingPermissions" }
  | { kind: "wifiOff" }
  | { kind: "scanning"; attempt: number }
  | { kind: "joining"; ssid: string }
  | { kind: "connectingManually" }
  | { kind: "probing"; ssid: string }
  | { kind: "loadingNetworks" }
  | { kind: "delivering"; ssid: string }
  | { kind: "confirming"; ssid: string }
  | { kind: "leavingSetup" }
  | { kind: "waitingForHomeWifi"; ssid: string }
  | { kind: "verifying"; deviceID: string; ip?: string }
  | { kind: "renaming"; name: string };

export type Prompt =
  /** Why location is needed + setup-mode instructions; answered with `continue`. */
  | { kind: "rationale" }
  /** Only when more than one setup network is found; sorted by signal. */
  | { kind: "chooseSpeaker"; speakers: ScanResult[] }
  /**
   * Answered with `credentials`. `{ kind: "action", action: "retry" }` rescans
   * and republishes the prompt (refresh).
   */
  | {
      kind: "credentials";
      networks: HomeNetwork[];
      suggested?: string;
      /** The speaker refused the previous credentials (`suggested` is their SSID). */
      reason?: "rejected";
    }
  /** Static-IP instructions + "I'm connected". */
  | { kind: "manualJoin" }
  /**
   * After verify. Answered with `name` (`null` keeps `currentName`); names
   * failing `validateSpeakerName` are ignored.
   */
  | { kind: "nameSpeaker"; currentName: string; suggestions: string[] };

export type RecoveryAction =
  | "retry"
  | "requestPermission"
  | "openAppSettings"
  | "openLocationSettings"
  | "openWifiPanel"
  | "openWifiSettings"
  | "manualJoin"
  | "editCredentials"
  | "continueAnyway"
  | "enterIp"
  | "startOver";

export type PromptAnswer =
  | { kind: "continue" }
  | { kind: "chooseSpeaker"; bssid: string }
  | { kind: "credentials"; ssid: string; password: string }
  | { kind: "manualJoin"; connected: true }
  /** `null` keeps the current name. */
  | { kind: "name"; name: string | null }
  /** Must be one of the failed view's `actions` (`enterIp` excepted: answer with `enterIp`). */
  | { kind: "action"; action: RecoveryAction }
  /** Accepted while the failed view offers `enterIp`. */
  | { kind: "enterIp"; ip: string };

export type SetupView =
  | {
      kind: "working";
      step: StepId;
      detail: WorkingDetail;
      /** `Clock.now()` when this step started; unchanged while the step only updates its detail. */
      startedAt: number;
    }
  | { kind: "prompt"; prompt: Prompt }
  | { kind: "failed"; error: SetupError; actions: RecoveryAction[] }
  | {
      kind: "done";
      /** `name` is the final name: the new one, or the old one when kept or the rename failed. */
      speaker: SpeakerIdentity;
      host: string;
      /** Set when renaming failed; the speaker kept its old name. */
      renameFailed?: boolean;
    };

export interface SetupSession {
  subscribe: (listener: () => void) => () => void;
  /** Same object until the next publish (safe for `useSyncExternalStore`). */
  getView: () => SetupView;
  /** Idempotent. */
  start: () => void;
  /** Ignored unless it answers the current prompt or offers one of the current actions. */
  respond: (answer: PromptAnswer) => void;
  /** Aborts, awaits `wifi.release()`; idempotent. No view updates or port calls after it resolves. */
  cancel: () => Promise<void>;
}
