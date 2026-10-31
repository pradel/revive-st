import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/lib/logger";

import { parseKnownSpeakers, type KnownSpeaker } from "./known-speakers";

const KNOWN_SPEAKERS_KEY = "known_speakers";

export async function loadKnownSpeakers(): Promise<KnownSpeaker[]> {
  try {
    return parseKnownSpeakers(await AsyncStorage.getItem(KNOWN_SPEAKERS_KEY));
  } catch (error) {
    logger.warn("[speakers] Could not load the known speakers:", error);
    return [];
  }
}

export async function saveKnownSpeakers(
  speakers: readonly KnownSpeaker[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(KNOWN_SPEAKERS_KEY, JSON.stringify(speakers));
  } catch (error) {
    logger.warn("[speakers] Could not save the known speakers:", error);
  }
}
