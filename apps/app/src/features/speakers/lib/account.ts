import AsyncStorage from "@react-native-async-storage/async-storage";

import { pickHouseholdAccountId, type SpeakerAccount } from "./account-id";
import { mintAccountId, usesOurServer } from "./marge-api";

const HOUSEHOLD_ACCOUNT_KEY = "household_account_id";

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
  if (speaker.margeAccountUUID) {
    return speaker.margeAccountUUID;
  }
  const accountId =
    pickHouseholdAccountId({
      otherSpeakers,
      storedAccountId: await AsyncStorage.getItem(HOUSEHOLD_ACCOUNT_KEY),
      onOurServer: usesOurServer,
    }) ?? (await mintAccountId());
  await AsyncStorage.setItem(HOUSEHOLD_ACCOUNT_KEY, accountId);
  return accountId;
}
