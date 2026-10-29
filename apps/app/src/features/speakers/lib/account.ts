import AsyncStorage from "@react-native-async-storage/async-storage";

import { APP_CONFIG } from "@/config";

const HOUSEHOLD_ACCOUNT_KEY = "household_account_id";

/** Account ids end up in a telnet command line: no spaces or separators. */
export const isSafeAccountId = (accountId: string) =>
  /^[A-Za-z0-9-]+$/.test(accountId);

export interface SpeakerAccount {
  margeAccountId?: string;
  margeURL?: string;
}

/** The speaker's account, unless it is unpaired. */
const accountOf = (speaker: SpeakerAccount) =>
  speaker.margeAccountId === "" ? undefined : speaker.margeAccountId;

async function mintAccountId(): Promise<string> {
  const response = await fetch(`${APP_CONFIG.API_URL}/api/internal/accounts`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Could not create an account: ${response.status} ${response.statusText}`,
    );
  }
  const { accountId } = (await response.json()) as { accountId: string };
  return accountId;
}

/**
 * The account to pair `speaker` with, so every speaker in the household
 * shares one: the speaker's own, else the one the household's other speakers
 * on this server use, else the one this phone used before, else a new one.
 * Knowing it is what grants access to the household's presets.
 */
export async function resolveHouseholdAccountId(
  speaker: SpeakerAccount,
  otherSpeakers: readonly SpeakerAccount[],
): Promise<string> {
  const accountId =
    accountOf(speaker) ??
    otherSpeakers
      .filter((other) => other.margeURL?.includes(APP_CONFIG.API_URL))
      .map(accountOf)
      .find((id) => id !== undefined) ??
    (await AsyncStorage.getItem(HOUSEHOLD_ACCOUNT_KEY)) ??
    (await mintAccountId());
  await AsyncStorage.setItem(HOUSEHOLD_ACCOUNT_KEY, accountId);
  return accountId;
}
