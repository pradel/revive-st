import { Host, Slider as ComposeSlider } from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";

import { ComposeSliderSlots } from "./ComposeSliderSlots";
import type { SliderProps } from "./Slider.types";

/**
 * Material 3 slider with the app's thin track and round thumb instead of
 * Material's tall bar thumb and 16dp track.
 */
export function Slider({
  draft,
  minimumValue,
  maximumValue,
  accessibilityLabel,
  tint = "textPrimary",
  size = "small",
  style,
}: SliderProps) {
  return (
    <Host matchContents={{ vertical: true }} style={style}>
      <ComposeSlider
        value={draft.value}
        min={minimumValue}
        max={maximumValue}
        onValueChange={(next) => {
          draft.onValueChange(Math.round(next));
        }}
        onValueChangeFinished={() => {
          draft.onSlidingComplete();
        }}
        modifiers={[semantics({ contentDescription: accessibilityLabel })]}
      >
        <ComposeSliderSlots
          value={draft.value}
          min={minimumValue}
          max={maximumValue}
          tint={tint}
          size={size}
        />
      </ComposeSlider>
    </Host>
  );
}
