import { parseSpeakerServer, type SpeakerServer } from "./server-profiles";

/**
 * A speaker the phone has reached before: shown on the next launch right
 * away, with the server it used last time, and tried at its last address
 * while the network scan runs. Stored by `known-speakers-store.ts`.
 */
export interface KnownSpeaker {
  deviceID: string;
  name: string;
  type: string;
  host: string;
  port: number;
  /** As last checked; absent until it has been. */
  server?: SpeakerServer;
}

const isKnownSpeaker = (
  value: unknown,
): value is Omit<KnownSpeaker, "server"> & { server?: unknown } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.deviceID === "string" &&
    entry.deviceID.length > 0 &&
    typeof entry.name === "string" &&
    typeof entry.type === "string" &&
    typeof entry.host === "string" &&
    entry.host.length > 0 &&
    typeof entry.port === "number"
  );
};

/**
 * Reads the stored list, keeping only well-formed entries. A server that
 * can't be read is dropped and the speaker kept: it's checked again once the
 * speaker answers.
 */
export function parseKnownSpeakers(stored: string | null): KnownSpeaker[] {
  if (stored === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .filter(isKnownSpeaker)
    .map(({ deviceID, name, type, host, port, server }) => {
      const known = parseSpeakerServer(server);
      return known === undefined
        ? { deviceID, name, type, host, port }
        : { deviceID, name, type, host, port, server: known };
    });
}
