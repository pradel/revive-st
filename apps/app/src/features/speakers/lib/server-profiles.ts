import { DEFAULT_SERVER_URL } from "../../server/server-url";
import { isSameOrigin } from "./account-id";

/**
 * The servers a speaker can use instead of Bose's. Adding one is adding a
 * profile to `PROFILES`: how to tell the speaker uses it, its name, and what
 * setting the speaker up for our server does to it. Whether radio plays
 * through it is the speaker's to say (`speaker-radio.ts`), not the profile's.
 */
export const SERVER_KINDS = [
  "revive",
  "soundcork",
  "aftertouch",
  "streborn",
  "bose",
  "unknown",
] as const;

export type ServerKind = (typeof SERVER_KINDS)[number];

/**
 * What setting up a speaker that uses this server does:
 * - `setUp`: switches it to our server; it uses Bose's, or a Revive ST server.
 * - `warn`: switches it to our server after the user agrees to leave the one it uses.
 * - `blocked`: never offered; the server puts its own settings back at every start.
 *
 * Leaving a Revive ST server that isn't ours is warned about too, but which
 * one is ours can change: that's judged when the speaker is shown
 * (`radioStatus`), not stored with its server.
 */
export const SETUP_POLICIES = ["setUp", "warn", "blocked"] as const;

export type SetupPolicy = (typeof SETUP_POLICIES)[number];

/** The server a speaker uses. */
export interface SpeakerServer {
  readonly kind: ServerKind;
  /** The server's name as its users know it. */
  readonly name: string;
  readonly setup: SetupPolicy;
}

/** What a profile can go on to tell whether a speaker uses its server. */
export interface ServerClues {
  /** The speaker's address on the network. */
  readonly host: string;
  /** The speaker's Marge server, its `margeURL`. */
  readonly marge: URL;
  /** Our server's origin. */
  readonly ourServer: string;
}

export interface ServerProfile extends SpeakerServer {
  /**
   * Whether the speaker uses this server. Profiles are asked in order and the
   * first yes wins; one that asks the network first rules out the speakers
   * `clues` alone tell apart, so a speaker costs at most one request.
   */
  readonly identify: (
    clues: ServerClues,
    signal?: AbortSignal,
  ) => boolean | Promise<boolean>;
}

const PROBE_TIMEOUT_MS = 3000;

/** `url`'s JSON body; `undefined` when it doesn't answer with JSON in time. */
async function probeJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
  };
  const timeoutId = setTimeout(abort, PROBE_TIMEOUT_MS);
  signal?.addEventListener("abort", abort);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? ((await response.json()) as unknown) : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}

const field = (body: unknown, name: string): unknown =>
  typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)[name]
    : undefined;

/** Bose's own servers, which a stock speaker, and some that redirect it, call. */
const isBoseHost = (marge: URL) =>
  marge.hostname === "bose.com" || marge.hostname.endsWith(".bose.com");

/**
 * A server at its own origin, with no path: ours or AfterTouch, which both
 * serve Marge at their root, or one no profile knows.
 */
const isBareOrigin = (marge: URL) =>
  !isBoseHost(marge) && marge.pathname.replace(/\/+$/, "") === "";

/** STR's agent answers on 8888, or 17008 on the models that keep 8888 closed. */
const STR_PORTS = [8888, 17_008];

/** What a Revive ST server's `GET /` names itself (`SERVER_NAME` in `apps/api`). */
const REVIVE_API_NAME = "Revive ST API";

const PROFILES: readonly ServerProfile[] = [
  {
    // Ours and the one run for everyone are known by their address; another
    // one (a self-hosted server the app isn't set to) names itself at `/`.
    kind: "revive",
    name: "Revive ST",
    setup: "setUp",
    identify: async ({ marge, ourServer }, signal) =>
      isSameOrigin(marge.href, ourServer) ||
      isSameOrigin(marge.href, DEFAULT_SERVER_URL) ||
      (isBareOrigin(marge) &&
        field(await probeJson(`${marge.origin}/`, signal), "name") ===
          REVIVE_API_NAME),
  },
  {
    // Serves Marge under `/marge`, which no other server does.
    kind: "soundcork",
    name: "soundcork",
    setup: "warn",
    identify: ({ marge }) =>
      marge.pathname.replace(/\/+$/, "").endsWith("/marge"),
  },
  {
    // Runs on the speaker and resets its server addresses to Bose's at every
    // start, then answers for Bose's servers itself; its agent says so.
    kind: "streborn",
    name: "STR",
    setup: "blocked",
    identify: async ({ host, marge }, signal) => {
      if (!isBoseHost(marge)) {
        return false;
      }
      for (const port of STR_PORTS) {
        const version = field(
          await probeJson(`http://${host}:${port}/api/agent/version`, signal),
          "version",
        );
        if (typeof version === "string" && version !== "") {
          return true;
        }
      }
      return false;
    },
  },
  {
    // AfterTouch (Bose-SoundTouch's soundtouch-service) serves Marge at its
    // root, like ours, and reports its health. Pointed at through DNS instead,
    // a speaker keeps Bose's address and reads as Bose's.
    kind: "aftertouch",
    name: "AfterTouch",
    setup: "warn",
    identify: async ({ marge }, signal) => {
      if (!isBareOrigin(marge)) {
        return false;
      }
      const health = await probeJson(`${marge.origin}/health`, signal);
      return (
        field(health, "status") === "up" &&
        typeof field(health, "timestamp") === "string"
      );
    },
  },
  {
    kind: "bose",
    name: "Bose",
    setup: "setUp",
    identify: ({ marge }) => isBoseHost(marge),
  },
];

/**
 * The server a speaker uses, from its `margeURL` and, for the servers that
 * can't be told from it, a request to the speaker or the server. A server no
 * profile knows is named by its address.
 */
export async function identifyServer(
  speaker: { host: string; margeURL: string; ourServer: string },
  signal?: AbortSignal,
): Promise<SpeakerServer> {
  let marge: URL;
  try {
    marge = new URL(speaker.margeURL);
  } catch {
    return { kind: "unknown", name: "another server", setup: "warn" };
  }
  const clues: ServerClues = {
    host: speaker.host,
    marge,
    ourServer: speaker.ourServer,
  };
  for (const profile of PROFILES) {
    if (await profile.identify(clues, signal)) {
      return { kind: profile.kind, name: profile.name, setup: profile.setup };
    }
  }
  return { kind: "unknown", name: marge.host, setup: "warn" };
}
