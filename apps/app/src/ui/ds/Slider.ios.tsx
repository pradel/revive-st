import { Host, Slider as SwiftUISlider } from "@expo/ui/swift-ui";
import {
  accessibilityLabel as accessibilityLabelModifier,
  scaleEffect,
  tint as tintModifier,
} from "@expo/ui/swift-ui/modifiers";
import { View, type ViewStyle } from "react-native";

import { color } from "@/ui/tokens";

import type { SliderProps } from "./Slider.types";

/**
 * SwiftUI can't restyle the slider's thumb or track, so the native slider is
 * scaled down instead. Scaling also shrinks its width, so it's laid out wider
 * by the inverse factor and centered to still fill its container.
 */
const scales = { small: 0.6, regular: 0.75 } as const;

export function Slider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  accessibilityLabel,
  tint = "textPrimary",
  size = "small",
  style,
}: SliderProps) {
  const scale = scales[size];
  const widthPercent = 100 / scale;
  const $stretch: ViewStyle = {
    width: `${widthPercent}%`,
    marginLeft: `${-(widthPercent - 100) / 2}%`,
  };

  return (
    <View style={style}>
      <View style={$stretch}>
        <Host matchContents={{ vertical: true }}>
          <SwiftUISlider
            value={value}
            min={minimumValue}
            max={maximumValue}
            onValueChange={(next) => {
              onValueChange(Math.round(next));
            }}
            modifiers={[
              tintModifier(color[tint]),
              scaleEffect(scale),
              accessibilityLabelModifier(accessibilityLabel),
            ]}
          />
        </Host>
      </View>
    </View>
  );
}
