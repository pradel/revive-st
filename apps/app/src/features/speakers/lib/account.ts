import AsyncStorage from "@react-native-async-storage/async-storage";

import { APP_CONFIG } from "@/config";

import {
  isHouseholdAccountId,
  pickHouseholdAccountId,
  type SpeakerAccount,
} from "./account-id";

const HOUSEHOLD_ACCOUNT_KEY = "household_account_id";

async function mintAccountId(): Promise<string> {
  const response = await fetch(`${APP_CONFIG.API_URL}/api/internal/accounts`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Could not create an account: ${response.status} ${response.statusText}`,
    );
  }
  const { accountId } = (await response.json()) as { accountId?: unknown };
  if (typeof accountId !== "string" || !isHouseholdAccountId(accountId)) {
    throw new Error("The server returned an invalid account id");
  }
  return accountId;
}

/**
 * The account `speaker` is paired with when configured. A paired speaker
 * keeps its own; an unpaired one joins its household's account, minted when
 * the household has none yet. Knowing it is what grants access to the
 * household's presets.
 */
export async function resolveHouseholdAccountId(
  speaker: SpeakerAccount,
  otherSpeakers: readonly SpeakerAccount[],
): Promise<string> {
  if (speaker.margeAccountId) {
    return speaker.margeAccountId;
  }
  const accountId =
    pickHouseholdAccountId({
      otherSpeakers,
      storedAccountId: await AsyncStorage.getItem(HOUSEHOLD_ACCOUNT_KEY),
      serverUrl: APP_CONFIG.API_URL,
    }) ?? (await mintAccountId());
  await AsyncStorage.setItem(HOUSEHOLD_ACCOUNT_KEY, accountId);
  return accountId;
}
