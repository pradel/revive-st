import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";

const INTRO_SEEN_KEY = "local_network_intro_seen";

/**
 * Whether the first-launch screen explaining Local Network access is still
 * to be shown. iOS asks for that permission the first time the app looks for
 * speakers, so the scan waits until the user has read why. Android asks for
 * nothing: always `done`.
 */
export type LocalNetworkIntro = "loading" | "needed" | "done";

let intro: LocalNetworkIntro = Platform.OS === "ios" ? "loading" : "done";
const listeners = new Set<() => void>();

function publish(next: LocalNetworkIntro) {
  intro = next;
  for (const listener of listeners) {
    listener();
  }
}

export function useLocalNetworkIntro(): LocalNetworkIntro {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => intro,
  );
}

export async function loadLocalNetworkIntro(): Promise<void> {
  if (intro !== "loading") {
    return;
  }
  try {
    const seen = await AsyncStorage.getItem(INTRO_SEEN_KEY);
    publish(seen === null ? "needed" : "done");
  } catch (error) {
    logger.warn("[local-network] Could not read the intro flag:", error);
    publish("done");
  }
}

/** The user read the intro: the app may look for speakers now. */
export async function finishLocalNetworkIntro(): Promise<void> {
  publish("done");
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch (error) {
    logger.warn("[local-network] Could not save the intro flag:", error);
  }
}
