import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { logger } from "@/lib/logger";

import { useSpeakers } from "../registry/store";
import type { BoseSpeaker } from "../registry/types";
import { resolveSelectedSpeaker } from "./selected-speaker";

const SELECTED_SPEAKER_KEY = "selected_speaker";

/**
 * The device id of the speaker the user last acted on (see
 * `resolveSelectedSpeaker`); `null` until they pick one. Remembered across
 * launches.
 */
interface Selection {
  readonly loaded: boolean;
  readonly deviceID: string | null;
}

let selection: Selection = { loaded: false, deviceID: null };
const listeners = new Set<() => void>();

function publish(next: Selection) {
  selection = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSelection = () => selection;

export async function loadSelectedSpeaker(): Promise<void> {
  if (selection.loaded) {
    return;
  }
  try {
    const deviceID = await AsyncStorage.getItem(SELECTED_SPEAKER_KEY);
    // A pick made while loading wins over the stored one.
    publish({ loaded: true, deviceID: selection.deviceID ?? deviceID });
  } catch (error) {
    logger.warn("[selection] Could not read the selected speaker:", error);
    publish({ ...selection, loaded: true });
  }
}

/** The user acted on this speaker: it's the one the app controls now. */
export function selectSpeaker(deviceID: string): void {
  if (selection.deviceID === deviceID) {
    return;
  }
  publish({ ...selection, deviceID });
  AsyncStorage.setItem(SELECTED_SPEAKER_KEY, deviceID).catch(
    (error: unknown) => {
      logger.warn("[selection] Could not save the selected speaker:", error);
    },
  );
}

/** Whether the remembered selection was read (the first screen can show). */
export function useSelectionLoaded(): boolean {
  return useSyncExternalStore(subscribe, getSelection).loaded;
}

/** The speaker the app controls, listed but not necessarily online. */
export function useSelectedSpeaker(): BoseSpeaker | undefined {
  const { listed } = useSpeakers();
  const { deviceID } = useSyncExternalStore(subscribe, getSelection);
  return resolveSelectedSpeaker(listed, deviceID);
}

/** Whether another reached speaker could be selected instead. */
export function useCanSwitchSpeaker(): boolean {
  const { online } = useSpeakers();
  const selected = useSelectedSpeaker();
  return online.some((speaker) => speaker.deviceID !== selected?.deviceID);
}
