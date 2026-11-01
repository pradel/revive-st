import type { Preset, Speaker, SpeakerState } from "bose-api-speaker-client";

import type { KnownSpeaker } from "../lib/known-speakers";
import type { SpeakerRadio } from "../lib/speaker-radio";

/** What a speaker's `/info` says, as far as the list needs it. */
export interface SpeakerInfo {
  deviceID: string;
  name: string;
  type: string;
  margeURL: string;
  margeAccountUUID: string;
}

export interface SpeakerLinkEvents {
  /** The speaker's state changed, once `open` has resolved. */
  onState: (state: SpeakerState) => void;
  /** The speaker says its info (account, server) or its sources changed. */
  onSettingsChange: () => void;
}

/** The live connection to one speaker. */
export interface SpeakerLink {
  readonly host: string;
  readonly port: number;
  /** The speaker's client, for commands. */
  readonly client: Speaker;
  /** Opens the live connection and reads everything the speaker shows. */
  open: () => Promise<SpeakerState>;
  /** Whether the live connection is still up. */
  isConnected: () => boolean;
  /** Re-reads everything; the result arrives through `onState`. */
  refresh: () => Promise<void>;
  /** Opens the live connection again (after the app was away) and re-reads. */
  reconnect: () => void;
  /** Closes it; no event follows. */
  close: () => void;
}

export interface SpeakerRegistryDeps {
  speaker: {
    /** The speaker's `/info`; `undefined` when it doesn't answer in time. */
    info: (host: string, port: number) => Promise<SpeakerInfo | undefined>;
    /** How the speaker gets internet radio. Throws when it doesn't answer. */
    radio: (
      speaker: {
        host: string;
        port: number;
        margeURL: string;
        margeAccountUUID: string;
      },
      ourServer: string,
    ) => Promise<SpeakerRadio>;
    link: (
      host: string,
      port: number,
      deviceID: string,
      events: SpeakerLinkEvents,
    ) => SpeakerLink;
  };
  /** Looks for speakers on the network until the returned function is called. */
  scanner: {
    start: (
      onFound: (host: string, port: number) => void,
      onError: (message: string) => void,
    ) => () => void;
  };
  storage: {
    load: () => Promise<KnownSpeaker[]>;
    save: (speakers: readonly KnownSpeaker[]) => Promise<void>;
  };
  ourServer: {
    /** Our server's origin, read at the moment it's used. */
    url: () => string;
    /** Stores a speaker's presets on our server, under its account. */
    syncPresets: (
      accountId: string,
      deviceID: string,
      presets: Preset[],
    ) => Promise<void>;
  };
  /** Runs `run` after `ms`; the returned function cancels it. */
  later: (run: () => void, ms: number) => () => void;
  log: { warn: (message: string, error?: unknown) => void };
}
