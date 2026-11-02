import type { SwitchableSource } from "./sources";

/**
 * The player's bottom bar: the source menu (`SWITCHABLE_SOURCES`) on the
 * left, the speaker shown in the middle (tap to pick another one), its
 * settings on the right.
 */
export interface PlayerBarProps {
  speakerName: string;
  /** The speaker's current source, checked in the menu. */
  currentSource?: string;
  onSelectSource: (source: SwitchableSource) => void;
  onChooseSpeaker: () => void;
  onOpenSettings: () => void;
}
