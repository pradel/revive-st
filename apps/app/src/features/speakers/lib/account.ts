import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

import {
  isSameOrigin,
  pickHouseholdAccountId,
  type SpeakerAccount,
} from "./account-id";

/** Per server: an account lives on the server its speakers are paired on. */
const HOUSEHOLD_ACCOUNT_KEY_PREFIX = "household_account_id:";

/**
 * The account `speaker` is paired with when configured. A paired speaker
 * keeps its own; an unpaired one joins its household's account, made here (a
 * random UUID from the system's secure random source) when the household has
 * none yet. Knowing it is what grants access to the household's presets.
 */
export async function resolveHouseholdAccountId(
  origin: string,
  speaker: SpeakerAccount,
  otherSpeakers: readonly SpeakerAccount[],
): Promise<string> {
  if (speaker.margeAccountUUID) {
    return speaker.margeAccountUUID;
  }
  const storageKey = `${HOUSEHOLD_ACCOUNT_KEY_PREFIX}${origin}`;
  const accountId =
    pickHouseholdAccountId({
      otherSpeakers,
      storedAccountId: await AsyncStorage.getItem(storageKey),
      onOurServer: (margeURL) => isSameOrigin(margeURL, origin),
    }) ?? randomUUID();
  await AsyncStorage.setItem(storageKey, accountId);
  return accountId;
}
