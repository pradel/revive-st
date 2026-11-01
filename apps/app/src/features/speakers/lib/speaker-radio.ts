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

/** How a speaker gets internet radio. */
export interface SpeakerRadio {
  readonly server: SpeakerServer;
  /** The speaker's Marge server, its `margeURL`. */
  readonly margeURL: string;
  /** It uses our server and is paired with an account on it. */
  readonly onOurServer: boolean;
  readonly sources: StationSources;
  /**
   * It plays internet radio through its server: one that isn't Bose's (gone),
   * with an account and a station source ready. A server we don't know
   * counts too; a station it then fails to play says so when it's started.
   */
  readonly ready: boolean;
}

export function speakerRadio({
  server,
  margeURL,
  accountId,
  sources,
  ourServer,
}: {
  server: SpeakerServer;
  margeURL: string;
  accountId: string;
  sources: StationSources;
  ourServer: string;
}): SpeakerRadio {
  const paired = accountId !== "";
  return {
    server,
    margeURL,
    onOurServer: paired && isSameOrigin(margeURL, ourServer),
    sources,
    ready:
      server.kind !== "bose" &&
      paired &&
      (sources.radioBrowser || sources.customStations),
  };
}

/**
 * The speaker's server as the screens name it: by its address when it's
 * another Revive ST server than ours, else by its profile's name.
 */
export function radioServerName(radio: SpeakerRadio): string {
  if (radio.server.kind !== "revive") {
    return radio.server.name;
  }
  try {
    return new URL(radio.margeURL).host;
  } catch {
    return radio.server.name;
  }
}

/**
 * The speaker's radio in a few words, for a line under its name: whether it
 * needs setting up, or the other server it plays through. Nothing for a
 * speaker ready on our server, or not checked yet.
 */
export function radioSummary(
  radio: SpeakerRadio | undefined,
): string | undefined {
  if (!radio) {
    return undefined;
  }
  if (!radio.ready) {
    return "Radio needs setup";
  }
  return radio.onOurServer ? undefined : `Radio via ${radioServerName(radio)}`;
}

/**
 * Reads how a speaker gets internet radio, from its `/info` (`margeURL`,
 * `accountId`, already read by the caller) and its `/sources`. Throws when
 * it doesn't answer.
 */
export async function readSpeakerRadio(
  speaker: {
    host: string;
    port: number;
    margeURL: string;
    accountId: string;
  },
  ourServer: string,
  signal?: AbortSignal,
): Promise<SpeakerRadio> {
  const { host, port, margeURL, accountId } = speaker;
  const sources = await boseSpeakerClient({ ip: host, port }).getSources({
    signal,
  });
  if (sources.isErr()) {
    throw sources.error;
  }
  return speakerRadio({
    server: await identifyServer({ host, margeURL, ourServer }, signal),
    margeURL,
    accountId,
    sources: stationSources(sources.value.sourceItems),
    ourServer,
  });
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
  onOurServer?: unknown;
  ready?: unknown;
}

/** A stored `SpeakerRadio`, or `undefined` when it isn't one (an older or damaged entry). */
export function parseSpeakerRadio(value: unknown): SpeakerRadio | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { server, margeURL, sources, onOurServer, ready } =
    value as StoredRadio;
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
    typeof onOurServer !== "boolean" ||
    typeof ready !== "boolean"
  ) {
    return undefined;
  }
  return {
    server: { kind: server.kind, name: server.name, setup: server.setup },
    margeURL,
    onOurServer,
    sources: {
      radioBrowser: sources.radioBrowser,
      customStations: sources.customStations,
    },
    ready,
  };
}
