/**
 * Whether `accountId` is one our server minted: a random UUID. Only those are
 * shared between a household's speakers; a shared or guessable id a speaker
 * was paired with elsewhere (`revivest-user`, a Bose cloud account number)
 * never spreads to another speaker.
 */
export const isHouseholdAccountId = (
  accountId: string | null | undefined,
): accountId is string =>
  typeof accountId === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    accountId,
  );

/** Account ids end up in a telnet command line: no spaces or separators. */
export const isSafeAccountId = (accountId: string) =>
  /^[A-Za-z0-9-]+$/.test(accountId);

export interface SpeakerAccount {
  margeAccountUUID?: string;
  margeURL?: string;
}

/**
 * The household account an unpaired speaker joins: the one another of the
 * household's speakers on our server uses, else the one this phone used
 * before. `undefined` when the household has none yet.
 */
export const pickHouseholdAccountId = ({
  otherSpeakers,
  storedAccountId,
  onOurServer,
}: {
  otherSpeakers: readonly SpeakerAccount[];
  storedAccountId: string | null;
  onOurServer: (margeURL: string | undefined) => boolean;
}): string | undefined =>
  otherSpeakers
    .filter((other) => onOurServer(other.margeURL))
    .map((other) => other.margeAccountUUID)
    .find(isHouseholdAccountId) ??
  (isHouseholdAccountId(storedAccountId) ? storedAccountId : undefined);
