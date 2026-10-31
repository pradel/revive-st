import type { SpeakerAccount } from "../../speakers/lib/account-id";
import type { ConfigureError } from "./errors";

/** What the user sees as steps, in order. */
export type StepId = "prepare" | "connect" | "restart" | "verify";

export const STEP_IDS: readonly StepId[] = [
  "prepare",
  "connect",
  "restart",
  "verify",
];

/** The speaker being set up, as the speaker list knows it. */
export interface ConfigureTarget {
  deviceID: string;
  name: string;
  host: string;
  /** The household's other speakers: an unpaired speaker joins their account. */
  otherSpeakers: readonly SpeakerAccount[];
}

export type WorkingDetail =
  | { kind: "checkingSpeaker" }
  | { kind: "savingPresets" }
  | { kind: "writingSettings" }
  | { kind: "pairing" }
  | { kind: "refreshingSources" }
  | { kind: "restarting" }
  | { kind: "waitingForShutdown" }
  | { kind: "waitingForSpeaker" }
  | { kind: "checkingSettings" }
  | { kind: "waitingForServer" };

/**
 * `retry` runs the whole setup again: every step is safe to repeat.
 * `checkAgain` waits for the restarted speaker and checks it again, without
 * changing anything.
 */
export type RecoveryAction = "retry" | "checkAgain";

export type ConfigureView =
  | {
      kind: "working";
      step: StepId;
      detail: WorkingDetail;
      /** When `step` started; unchanged while only `detail` changes. */
      startedAt: number;
    }
  | {
      kind: "failed";
      step: StepId;
      error: ConfigureError;
      actions: RecoveryAction[];
    }
  | {
      kind: "done";
      /** The speaker's address after the restart. */
      host: string;
      /**
       * Whether the server confirmed the speaker's request after the restart;
       * false only with a server that can't tell.
       */
      serverConfirmed: boolean;
    };

export interface ConfigureSession {
  subscribe: (listener: () => void) => () => void;
  getView: () => ConfigureView;
  /** Starts the run; does nothing once started. */
  start: () => void;
  /** Ignored unless the failed view offers `action`. */
  act: (action: RecoveryAction) => void;
  /** Stops the run. Settings already sent to the speaker stay. */
  cancel: () => Promise<void>;
}
