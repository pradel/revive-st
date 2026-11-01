import { boseSpeakerClient, type SourceItem } from "bose-api-speaker-client";

import { isSameOrigin } from "./account-id";
import {
  identifyServer,
  SERVER_KINDS,
  SETUP_POLICIES,
  type SpeakerServer,
} from "./server-profiles";

/**
 * The kinds of station a speaker plays: the sources its server gave it that
 * it reports `READY`. A speaker whose server it can't use reports them
 * `UNAVAILABLE`, and one only plays or keeps stations of a source it lists.
 */
export interface StationSources {
  /** `RADIO_BROWSER`: Radio Browser stations, by their id. */
  readonly radioBrowser: boolean;
  /** `LOCAL_INTERNET_RADIO`: streams, carried in the station's location. */
  readonly customStations: boolean;
}

export const stationSources = (
  items: readonly Pick<SourceItem, "source" | "status">[],
): StationSources => {
  const ready = (source: string) =>
    items.some((item) => item.source === source && item.status === "READY");
  return {
    radioBrowser: ready("RADIO_BROWSER"),
    customStations: ready("LOCAL_INTERNET_RADIO"),
  };
};

/**
 * How a speaker gets internet radio, as read from it: what it says, not what
 * that means, so it can be remembered and judged again against whichever
 * server is ours (`radioStatus`).
 */
export interface SpeakerRadio {
  readonly server: SpeakerServer;
  /** The speaker's Marge server, its `margeURL`. */
  readonly margeURL: string;
  /** It's paired with an account on that server. */
  readonly paired: boolean;
  readonly sources: StationSources;
}

/**
 * What setting the speaker up for our server does: set it up (`setUp`), set
 * it up again (`again`, it's paired on ours already), only after the user
 * agrees to leave the server it uses (`leaving`), or nothing (`blocked`, its
 * server puts its own settings back at every start).
 */
export type SetupOffer =
  | { readonly kind: "setUp" }
  | { readonly kind: "again" }
  | { readonly kind: "leaving"; readonly server: string }
  | { readonly kind: "blocked"; readonly server: string };

/** What a speaker's radio, once checked, means for the screens. */
interface CheckedRadio {
  /** Its server's name as its users know it, e.g. "Revive ST" or "soundcork". */
  readonly serverName: string;
  /** Its Marge server, its `margeURL`. */
  readonly margeURL: string;
  /**
   * The server it plays through, as a sentence names it; `null` when it's
   * ours. Another Revive ST server, which shares our name, goes by its address.
   */
  readonly through: string | null;
  readonly setup: SetupOffer;
  readonly sources: StationSources;
}

/**
 * How a listed speaker gets internet radio. `checking` until a check first
 * answers; `unreachable` when the speaker didn't answer it. Once known, the
 * last result stands while a later check runs or fails. `ready`: it plays
 * internet radio through its server, one that isn't Bose's (gone), with an
 * account and a station source ready. A server we don't know counts on the
 * same terms; a station it then fails to play says so when it's started.
 */
export type RadioStatus =
  | { readonly kind: "checking" }
  | { readonly kind: "unreachable" }
  | ({ readonly kind: "ready" } & CheckedRadio)
  | ({ readonly kind: "needsSetup" } & CheckedRadio);

function setupOffer(
  radio: SpeakerRadio,
  ours: boolean,
  through: string,
): SetupOffer {
  if (radio.server.setup === "blocked") {
    return { kind: "blocked", server: through };
  }
  if (ours) {
    return radio.paired ? { kind: "again" } : { kind: "setUp" };
  }
  // Another Revive ST server than ours is one the speaker would leave.
  return radio.server.setup === "warn" || radio.server.kind === "revive"
    ? { kind: "leaving", server: through }
    : { kind: "setUp" };
}

/**
 * The speaker's radio, as last read (`undefined` until a check answers),
 * judged against our server; `lastCheckFailed` when the latest check wasn't
 * answered.
 */
export function radioStatus(
  radio: SpeakerRadio | undefined,
  lastCheckFailed: boolean,
  ourServer: string,
): RadioStatus {
  if (!radio) {
    return { kind: lastCheckFailed ? "unreachable" : "checking" };
  }
  const { server, margeURL, paired, sources } = radio;
  const ours = isSameOrigin(margeURL, ourServer);
  const named =
    server.kind === "revive" ? hostOf(margeURL, server.name) : server.name;
  const ready =
    server.kind !== "bose" &&
    paired &&
    (sources.radioBrowser || sources.customStations);
  return {
    kind: ready ? "ready" : "needsSetup",
    serverName: server.name,
    margeURL,
    through: ours ? null : named,
    setup: setupOffer(radio, ours, named),
    sources,
  };
}

const hostOf = (url: string, fallback: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return fallback;
  }
};

/**
 * Reads how a speaker gets internet radio, from its `/info` (`margeURL`,
 * `margeAccountUUID`, already read by the caller) and its `/sources`.
 * Throws when it doesn't answer.
 */
export async function readSpeakerRadio(
  speaker: {
    host: string;
    port: number;
    margeURL: string;
    margeAccountUUID: string;
  },
  ourServer: string,
  signal?: AbortSignal,
): Promise<SpeakerRadio> {
  const { host, port, margeURL, margeAccountUUID } = speaker;
  const sources = await boseSpeakerClient({ ip: host, port }).getSources({
    signal,
  });
  if (sources.isErr()) {
    throw sources.error;
  }
  return {
    server: await identifyServer({ host, margeURL, ourServer }, signal),
    margeURL,
    paired: margeAccountUUID !== "",
    sources: stationSources(sources.value.sourceItems),
  };
}

const isOneOf = <Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value => values.includes(value as Value);

/** What may be stored for a `SpeakerRadio`: any field can be missing or wrong. */
interface StoredRadio {
  server?: { kind?: unknown; name?: unknown; setup?: unknown } | null;
  sources?: { radioBrowser?: unknown; customStations?: unknown } | null;
  margeURL?: unknown;
  paired?: unknown;
}

/** A stored `SpeakerRadio`, or `undefined` when it isn't one (an older or damaged entry). */
export function parseSpeakerRadio(value: unknown): SpeakerRadio | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { server, margeURL, sources, paired } = value as StoredRadio;
  if (
    typeof server !== "object" ||
    server === null ||
    typeof sources !== "object" ||
    sources === null ||
    !isOneOf(SERVER_KINDS, server.kind) ||
    typeof server.name !== "string" ||
    !isOneOf(SETUP_POLICIES, server.setup) ||
    typeof sources.radioBrowser !== "boolean" ||
    typeof sources.customStations !== "boolean" ||
    typeof margeURL !== "string" ||
    typeof paired !== "boolean"
  ) {
    return undefined;
  }
  return {
    server: { kind: server.kind, name: server.name, setup: server.setup },
    margeURL,
    paired,
    sources: {
      radioBrowser: sources.radioBrowser,
      customStations: sources.customStations,
    },
  };
}
