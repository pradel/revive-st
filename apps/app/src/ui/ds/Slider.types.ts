import type { StyleProp, ViewStyle } from "react-native";

import type { SliderDraft } from "@/lib/useSliderDraft";
import type { ColorName } from "@/ui/tokens";

export interface SliderProps {
  /** Draft from `useSliderDraft`: the value shown and the drag handlers. */
  draft: SliderDraft;
  minimumValue: number;
  maximumValue: number;
  accessibilityLabel: string;
  /** Filled track color. */
  tint?: ColorName;
  /** `small` for inline controls (speaker card), `regular` for the player. */
  size?: "small" | "regular";
  style?: StyleProp<ViewStyle>;
}

/** Track thickness and thumb diameter, in points/dp. */
export const sliderDimensions = {
  small: { track: 4, thumb: 16 },
  regular: { track: 6, thumb: 18 },
} as const;
