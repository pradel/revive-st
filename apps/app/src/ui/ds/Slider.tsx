import { Slider as NativeSlider } from "@expo/ui/community/slider";
import type { StyleProp, ViewStyle } from "react-native";

import { color, type ColorName } from "@/ui/tokens";

export interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  /** Called with whole numbers while dragging. */
  onValueChange: (value: number) => void;
  accessibilityLabel: string;
  /** Active track color. */
  tint?: ColorName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native slider (SwiftUI on iOS, Material 3 on Android) in the app's colors.
 * Pair with `useDraftValue` to send the value once a drag settles.
 */
export function Slider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  accessibilityLabel,
  tint = "textPrimary",
  style,
}: SliderProps) {
  return (
    <NativeSlider
      value={value}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      minimumTrackTintColor={color[tint]}
      maximumTrackTintColor={color.surface3}
      thumbTintColor={color.textPrimary}
      accessibilityLabel={accessibilityLabel}
      style={style}
      onValueChange={(next) => {
        onValueChange(Math.round(next));
      }}
    />
  );
}
