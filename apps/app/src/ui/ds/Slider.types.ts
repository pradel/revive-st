import type { StyleProp, ViewStyle } from "react-native";

import type { ColorName } from "@/ui/tokens";

export interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  /** Called with whole numbers while dragging. */
  onValueChange: (value: number) => void;
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
