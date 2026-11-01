import { parseSpeakerRadio, type SpeakerRadio } from "./speaker-radio";

/**
 * A speaker the phone has reached before: shown on the next launch right
 * away, with how it got internet radio last time, and tried at its last
 * address while the network scan runs. Stored by `known-speakers-store.ts`.
 */
export interface KnownSpeaker {
  deviceID: string;
  name: string;
  type: string;
  host: string;
  port: number;
  /** As last checked; absent until it has been. */
  radio?: SpeakerRadio;
}

const isKnownSpeaker = (
  value: unknown,
): value is Omit<KnownSpeaker, "radio"> & { radio?: unknown } => {
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
 * Reads the stored list, keeping only well-formed entries. A radio status
 * that can't be read is dropped and the speaker kept: it's read again once
 * the speaker answers.
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
    .map(({ deviceID, name, type, host, port, radio }) => {
      const known = parseSpeakerRadio(radio);
      return known === undefined
        ? { deviceID, name, type, host, port }
        : { deviceID, name, type, host, port, radio: known };
    });
}
