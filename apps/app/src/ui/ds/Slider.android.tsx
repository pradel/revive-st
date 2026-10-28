import { Box, Host, Slider as ComposeSlider } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  height,
  semantics,
  Shapes,
  size as sizeModifier,
} from "@expo/ui/jetpack-compose/modifiers";

import { color } from "@/ui/tokens";

import { sliderDimensions, type SliderProps } from "./Slider.types";

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
  const { track, thumb } = sliderDimensions[size];
  // The custom track is drawn from JS, so it fills to the current value itself.
  const fraction = Math.min(
    1,
    Math.max(0, (draft.value - minimumValue) / (maximumValue - minimumValue)),
  );

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
        <ComposeSlider.Thumb>
          <Box
            modifiers={[
              sizeModifier(thumb, thumb),
              clip(Shapes.Circle),
              background(color.textPrimary),
            ]}
          />
        </ComposeSlider.Thumb>
        <ComposeSlider.Track>
          <Box
            modifiers={[
              fillMaxWidth(),
              height(track),
              // oxlint-disable-next-line react/capitalized-calls -- Compose shape factory, not a component
              clip(Shapes.RoundedCorner(track / 2)),
              background(color.surface3),
            ]}
          >
            <Box
              modifiers={[
                fillMaxWidth(fraction),
                height(track),
                background(color[tint]),
              ]}
            />
          </Box>
        </ComposeSlider.Track>
      </ComposeSlider>
    </Host>
  );
}
