import { Box, Slider as ComposeSlider } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  height,
  Shapes,
  size as sizeModifier,
} from "@expo/ui/jetpack-compose/modifiers";

import { color, type ColorName } from "@/ui/tokens";

import { sliderDimensions } from "./Slider.types";

/**
 * Thumb and track slots for a Jetpack Compose `Slider`: the app's thin rounded
 * track and round thumb instead of Material 3's tall bar thumb and 16dp track.
 * The track is drawn from JS, so it fills to `value` itself and shows no step
 * ticks.
 */
export function ComposeSliderSlots({
  value,
  min,
  max,
  tint = "textPrimary",
  size = "small",
}: {
  value: number;
  min: number;
  max: number;
  /** Filled track color. */
  tint?: ColorName;
  size?: keyof typeof sliderDimensions;
}) {
  const { track, thumb } = sliderDimensions[size];
  const fraction =
    max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  return (
    <>
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
    </>
  );
}
