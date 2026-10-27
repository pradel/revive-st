const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;

/** Offered by the `nameSpeaker` prompt next to the current name. */
export const NAME_SUGGESTIONS: readonly string[] = [
  "Living room",
  "Kitchen",
  "Bedroom",
  "Office",
];

/** Same rule as the speaker settings screen: trimmed length 2–50. Returns the problem, if any. */
export function validateSpeakerName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) {
    return `Name must be at least ${MIN_NAME_LENGTH} characters`;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be at most ${MAX_NAME_LENGTH} characters`;
  }
  return undefined;
}
