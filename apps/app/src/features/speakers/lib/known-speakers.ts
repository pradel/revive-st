/**
 * A speaker the phone has reached before: shown on the next launch right
 * away, and tried at its last address while the network scan runs. Stored by
 * `known-speakers-store.ts`.
 */
export interface KnownSpeaker {
  deviceID: string;
  name: string;
  type: string;
  host: string;
  port: number;
}

const isKnownSpeaker = (value: unknown): value is KnownSpeaker => {
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

/** Reads the stored list, keeping only well-formed entries. */
export function parseKnownSpeakers(stored: string | null): KnownSpeaker[] {
  if (stored === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isKnownSpeaker) : [];
  } catch {
    return [];
  }
}
