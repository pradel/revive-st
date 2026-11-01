import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { useServerUrl } from "@/features/server/server";

import { createSpeakerRegistryDeps } from "./adapters";
import { createSpeakerRegistry } from "./registry";
import type { BoseSpeaker, SpeakersSnapshot } from "./types";

/** The app's speaker list; outlives every screen. */
export const speakerRegistry = createSpeakerRegistry(
  createSpeakerRegistryDeps(),
);

export function useSpeakers(): SpeakersSnapshot {
  return useSyncExternalStore(
    speakerRegistry.subscribe,
    speakerRegistry.getSnapshot,
  );
}

/** A reached speaker, by device id. */
export function useSpeaker(deviceID: string): BoseSpeaker | undefined {
  return useSpeakers().online.find((speaker) => speaker.deviceID === deviceID);
}

/**
 * Reaches the listed speakers and scans once `enabled` (see
 * `local-network`), again each time the app comes back from the background,
 * and checks their radio again when our server changes.
 */
export function useSpeakerDiscovery(enabled: boolean): void {
  const { restored } = useSpeakers();

  useEffect(() => {
    if (!enabled || !restored) {
      return;
    }
    speakerRegistry.reconnectAll();
    // Away once in the background; iOS can pass through `inactive` on the
    // way back to `active`.
    let away = false;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        away = true;
      } else if (next === "active" && away) {
        away = false;
        speakerRegistry.reconnectAll();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [enabled, restored]);

  const serverUrl = useServerUrl();
  const checkedFor = useRef(serverUrl);
  useEffect(() => {
    if (checkedFor.current !== serverUrl) {
      checkedFor.current = serverUrl;
      speakerRegistry.refreshAllRadio();
    }
  }, [serverUrl]);
}
