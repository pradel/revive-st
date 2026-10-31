import type { Preset } from "bose-api-speaker-client";
import { Pressable, View, type ViewStyle } from "react-native";

import { isRadioSource } from "@/features/speakers/lib/playback";
import { Artwork } from "@/ui/ds/Artwork";
import { icons } from "@/ui/ds/Icon";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

const SLOTS = [1, 2, 3, 4, 5, 6] as const;

/**
 * A speaker's six presets in one row, as on its preset buttons: artwork and
 * name for saved ones (tap to play), a numbered outline for empty ones.
 */
export function PresetStrip({
  presets,
  width,
  onPlay,
}: {
  presets: readonly Preset[];
  /**
   * The row's width, measured by the caller. Inside a form row (`RNHostView`)
   * flex alone sizes the slots by their captions, so they get fixed widths.
   */
  width: number | undefined;
  onPlay: (slot: number) => void;
}) {
  // Six equal slots; until the row is measured they share it by flex.
  const slot$ = [
    $slot,
    width === undefined
      ? $flex
      : { width: (width - space.xs * (SLOTS.length - 1)) / SLOTS.length },
  ];
  return (
    <View style={$row}>
      {SLOTS.map((slot) => {
        const preset = presets.find((item) => item.id === slot);
        if (!preset) {
          return (
            <View
              key={slot}
              style={slot$}
              accessible
              accessibilityLabel={`Preset ${slot}, empty`}
            >
              <View style={$empty}>
                <Text variant="subhead" color="textTertiary">
                  {String(slot)}
                </Text>
              </View>
              <Text variant="caption" color="textTertiary" numberOfLines={1}>
                Empty
              </Text>
            </View>
          );
        }
        const name = preset.contentItem.itemName || `Preset ${slot}`;
        return (
          <Pressable
            key={slot}
            style={({ pressed }) => [slot$, pressed && $pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Preset ${slot}: ${name}`}
            accessibilityHint="Plays the preset"
            onPress={() => {
              onPlay(slot);
            }}
          >
            <Artwork
              uri={preset.contentItem.containerArt || null}
              title={name}
              size="fill"
              radius={radius.xs}
              fallbackIcon={
                isRadioSource(preset.contentItem.source)
                  ? icons.radio
                  : icons.music
              }
            />
            <Text variant="caption" numberOfLines={1}>
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const $row: ViewStyle = {
  flexDirection: "row",
  gap: space.xs,
  paddingVertical: space.xxs,
};

const $slot: ViewStyle = {
  gap: space.xxs,
};

const $flex: ViewStyle = {
  flex: 1,
};

const $pressed: ViewStyle = {
  opacity: 0.6,
};

const $empty: ViewStyle = {
  width: "100%",
  aspectRatio: 1,
  borderRadius: radius.xs,
  borderWidth: 1,
  borderStyle: "dashed",
  borderColor: color.textTertiary,
  alignItems: "center",
  justifyContent: "center",
};
