import { type Result, TaggedError } from "better-result";
import type { Preset } from "bose-api-speaker-client";

import type { Clock, Discovery, Log } from "../../onboarding/session/ports";
import type { SpeakerAccount } from "../../speakers/lib/account-id";

/** A request that failed: network error, timeout, error reply or unreadable reply. */
export class PortFailure extends TaggedError("PortFailure")<{
  message: string;
}> {}

export interface SpeakerInfo {
  deviceID: string;
  name: string;
  /** The Marge server the speaker calls; may still be the old one until it restarts. */
  margeURL: string;
  /** Empty when the speaker isn't paired with an account. */
  margeAccountUUID: string;
}

/** Speaker HTTP API on port 8090. Calls reject only when `signal` aborts. */
export interface SpeakerPort {
  info: (
    host: string,
    signal: AbortSignal,
  ) => Promise<Result<SpeakerInfo, PortFailure>>;
  presets: (
    host: string,
    signal: AbortSignal,
  ) => Promise<Result<Preset[], PortFailure>>;
  /** `POST /setMargeAccount`: pairs the speaker with `accountId`. */
  setMargeAccount: (
    host: string,
    accountId: string,
    signal: AbortSignal,
  ) => Promise<Result<void, PortFailure>>;
  /** Tells the speaker its sources changed, so it fetches and saves them. */
  sourcesUpdated: (
    host: string,
    deviceID: string,
    signal: AbortSignal,
  ) => Promise<Result<void, PortFailure>>;
}

/** See `TelnetCommandFailure` in bose-api-speaker-client. */
export interface ConsoleFailure {
  reason: "notConnected" | "busy" | "noReply" | "closed" | "transport";
  message: string;
  reply?: string;
}

/** One connection to the speaker's TAP console (port 17000). */
export interface ConsoleConnection {
  /** Sends `command`; resolves with the reply once the speaker goes quiet. */
  run: (
    command: string,
    options?: { timeoutMs?: number },
  ) => Promise<Result<string, ConsoleFailure>>;
  close: () => void;
}

export interface ConsolePort {
  open: (host: string) => Promise<Result<ConsoleConnection, PortFailure>>;
}

/**
 * When the speaker last made a request to our server. `supported: false`:
 * the server predates the endpoint (a self-hosted one not yet updated).
 */
export type LastContact =
  | { supported: false }
  | { supported: true; at: number | null };

/** Our server. Calls reject only when `signal` aborts. */
export interface ServerPort {
  /** The server's origin, read once per run. */
  origin: () => string;
  /** The household account `speaker` gets paired with (see `resolveHouseholdAccountId`). */
  householdAccount: (
    speaker: SpeakerAccount,
    otherSpeakers: readonly SpeakerAccount[],
  ) => Promise<Result<string, PortFailure>>;
  /** Stores the speaker's presets under `accountId`, replacing what was stored. */
  savePresets: (
    accountId: string,
    deviceID: string,
    presets: Preset[],
    signal: AbortSignal,
  ) => Promise<Result<void, PortFailure>>;
  lastContact: (
    deviceID: string,
    signal: AbortSignal,
  ) => Promise<Result<LastContact, PortFailure>>;
}

export interface ConfigureDeps {
  speaker: SpeakerPort;
  console: ConsolePort;
  server: ServerPort;
  discovery: Discovery;
  clock: Clock;
  log: Log;
}
