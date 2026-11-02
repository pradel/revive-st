import type { nativeIcons } from "@/ui/nativeIcons";

/** An input the speaker can switch to, e.g. Bluetooth or AUX. */
export interface PlayerSource {
  id: string;
  title: string;
  icon: (typeof nativeIcons)[keyof typeof nativeIcons];
  /** The speaker is on this input. */
  selected: boolean;
}

/**
 * The player's bottom bar: the source menu on the left, the speaker shown
 * in the middle (tap to pick another one), its settings on the right.
 */
export interface PlayerBarProps {
  speakerName: string;
  onChooseSpeaker: () => void;
  onOpenSettings: () => void;
  sources: readonly PlayerSource[];
  onSelectSource: (id: string) => void;
}
