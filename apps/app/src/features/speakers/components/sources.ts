import { haptics } from "@/lib/haptics";
import { nativeIcons } from "@/ui/nativeIcons";

import { useSpeakerCommands } from "../hooks/useSpeakerCommands";
import type { BoseSpeaker } from "../registry/types";

/** An input the app can switch a speaker to, from its menus. */
export interface SwitchableSource {
  id: "BLUETOOTH" | "AUX";
  title: string;
  icon: (typeof nativeIcons)[keyof typeof nativeIcons];
  /** Sent along with the source: the speaker's AUX input needs one. */
  sourceAccount?: string;
}

/** The inputs Home's speaker menu and the player's source menu offer. */
export const SWITCHABLE_SOURCES: readonly SwitchableSource[] = [
  { id: "BLUETOOTH", title: "Bluetooth", icon: nativeIcons.bluetooth },
  { id: "AUX", title: "AUX", icon: nativeIcons.aux, sourceAccount: "AUX" },
];

/** Switches a speaker to one of `SWITCHABLE_SOURCES`. */
export function useSwitchSource() {
  const { selectSourceMutation } = useSpeakerCommands();
  return (speaker: BoseSpeaker, source: SwitchableSource) => {
    haptics.tap();
    selectSourceMutation.mutate({
      deviceID: speaker.deviceID,
      source: source.id,
      sourceAccount: source.sourceAccount,
    });
  };
}
