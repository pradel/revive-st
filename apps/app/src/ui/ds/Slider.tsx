import { Slider as NativeSlider } from "@expo/ui/community/slider";

import { color } from "@/ui/tokens";

import type { SliderProps } from "./Slider.types";

export type { SliderProps } from "./Slider.types";

/**
 * Native slider in the app's colors: SwiftUI on iOS, where the thumb and
 * track can't be restyled (`size` has no effect). `Slider.android.tsx` draws
 * the app's thin track and round thumb into Material 3's slider.
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
