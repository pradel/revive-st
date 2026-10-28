import { Slider as NativeSlider } from "@expo/ui/community/slider";

import { color } from "@/ui/tokens";

import type { SliderProps } from "./Slider.types";

export type { SliderProps } from "./Slider.types";

/**
 * Slider in the app's colors. The native versions are `Slider.ios.tsx`
 * (SwiftUI, scaled down since its thumb can't be restyled) and
 * `Slider.android.tsx` (Material 3 with the app's thin track and round
 * thumb); this fallback serves other platforms and type checking.
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
