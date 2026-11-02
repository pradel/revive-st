import type { ContentItem, Preset } from "bose-api-speaker-client";

import {
  type AccountSource,
  BOSE_URLS,
  type ServerUrls,
  type SpeakerConfig,
} from "./config.ts";

/** What the speaker plays. */
export type NowPlaying =
  | { readonly kind: "standby" }
  /** A content item; a station stays `BUFFERING_STATE` until its stream is resolved. */
  | {
      readonly kind: "playing";
      readonly contentItem: ContentItem;
      readonly playStatus: "BUFFERING_STATE" | "PLAY_STATE" | "PAUSE_STATE";
      readonly stationName: string;
      readonly art: string;
      /** The stream its BMX adapter resolved. */
      readonly streamUrl: string;
    }
  /** A station its BMX adapter couldn't resolve. */
  | { readonly kind: "invalid" };

/** A service the BMX registry advertises, by the source type it plays. */
export interface BmxService {
  readonly source: string;
  readonly baseUrl: string;
}

export interface SpeakerState {
  readonly name: string;
  readonly margeAccountUUID: string;
  /** Set by `envswitch accountid set`; applies at the next start. */
  readonly pendingAccountId: string | undefined;
  /** The addresses it runs with (`sys configuration`). */
  readonly running: ServerUrls;
  /** The addresses it starts with (`envswitch boseurls set`). */
  readonly saved: ServerUrls;
  readonly volume: number;
  readonly muted: boolean;
  readonly bass: number;
  readonly presets: readonly Preset[];
  readonly accountSources: readonly AccountSource[];
  /** Source types it had saved when it last started: only those play. */
  readonly activeSourceTypes: ReadonlySet<string>;
  /** Source types it has saved; they activate at the next start. */
  readonly savedSourceTypes: ReadonlySet<string>;
  readonly bmxServices: readonly BmxService[];
  readonly nowPlaying: NowPlaying;
  /** What POWER resumes. */
  readonly lastPlayed: ContentItem | undefined;
}

export const initialState = (config: SpeakerConfig): SpeakerState => {
  const urls = config.urls ?? BOSE_URLS;
  const accountSources = config.accountSources ?? [];
  const sourceTypes = new Set(accountSources.map(({ source }) => source));
  return {
    name: config.name ?? `SoundTouch ${config.deviceId.slice(-4)}`,
    margeAccountUUID: config.margeAccountUUID ?? "",
    pendingAccountId: undefined,
    running: urls,
    saved: urls,
    volume: 20,
    muted: false,
    bass: 0,
    presets: config.presets ?? [],
    accountSources,
    activeSourceTypes: sourceTypes,
    savedSourceTypes: sourceTypes,
    bmxServices: [],
    nowPlaying: { kind: "standby" },
    lastPlayed: undefined,
  };
};

/** A source as `/sources` lists it. */
export interface SourceItem {
  readonly source: string;
  readonly sourceAccount: string;
  readonly status: "READY" | "UNAVAILABLE";
  readonly name: string;
  readonly isLocal: boolean;
}

/** Sources on the speaker itself, listed whatever its account. */
export const LOCAL_SOURCES: readonly SourceItem[] = [
  {
    source: "AUX",
    sourceAccount: "AUX",
    status: "READY",
    name: "AUX IN",
    isLocal: true,
  },
  {
    source: "BLUETOOTH",
    sourceAccount: "",
    status: "UNAVAILABLE",
    name: "",
    isLocal: true,
  },
];

/** The sources `/sources` lists: local ones, then the account's. */
export const sourceItems = (state: SpeakerState): readonly SourceItem[] => [
  ...LOCAL_SOURCES,
  ...state.accountSources.map(({ source, sourceAccount }): SourceItem => ({
    source,
    sourceAccount,
    status: state.activeSourceTypes.has(source) ? "READY" : "UNAVAILABLE",
    name: sourceAccount,
    isLocal: false,
  })),
];

export const AUX_CONTENT_ITEM: ContentItem = {
  source: "AUX",
  type: "",
  location: "",
  sourceAccount: "AUX",
  isPresetable: false,
  itemName: "AUX IN",
  containerArt: "",
};
