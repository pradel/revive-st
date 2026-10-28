import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";

import { artwork, color, radius, space } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import type { IconName } from "./Icon";
import { Text } from "./Text";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Artwork image; a deterministic placeholder is used when missing. */
  artworkUri?: string | null;
  fallbackIcon?: IconName;
  /** Replaces the artwork entirely (e.g. an icon for a device). */
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Makes the row a radio option; a selected row is tinted with the accent. */
  selected?: boolean;
}

export function ListRow({
  title,
  subtitle,
  artworkUri,
  fallbackIcon,
  leading,
  trailing,
  onPress,
  disabled = false,
  selected,
}: ListRowProps) {
  const isRadio = selected !== undefined;
  // `trailing` is a sibling of the pressable area so controls in it (e.g. a
  // favorite button) stay separately focusable by screen readers.
  return (
    <View
      style={[
        $row,
        trailing !== undefined && $rowWithTrailing,
        selected === true && $selected,
        disabled && $disabled,
      ]}
    >
      <Pressable
        accessibilityRole={isRadio ? "radio" : onPress ? "button" : undefined}
        accessibilityState={isRadio ? { disabled, selected } : { disabled }}
        onPress={onPress}
        disabled={disabled || !onPress}
        style={({ pressed }) => [
          $main,
          trailing !== undefined && $mainWithTrailing,
          pressed && $pressed,
        ]}
      >
        {leading ?? (
          <Artwork
            uri={artworkUri}
            title={title}
            size={artwork.row}
            radius={radius.xs}
            fallbackIcon={fallbackIcon}
          />
        )}
        <View style={$text}>
          <Text
            variant="body"
            color={selected === true ? "accent" : "textPrimary"}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text variant="subhead" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

const $row: ViewStyle = {
  minHeight: 64,
  flexDirection: "row",
  alignItems: "center",
};

const $rowWithTrailing: ViewStyle = {
  paddingRight: space.screen,
};

const $main: ViewStyle = {
  flex: 1,
  alignSelf: "stretch",
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  paddingHorizontal: space.screen,
  paddingVertical: space.xs,
};

const $mainWithTrailing: ViewStyle = {
  paddingRight: space.sm,
};
const $pressed: ViewStyle = {
  backgroundColor: color.surface2,
};

const $selected: ViewStyle = {
  backgroundColor: color.accentMuted,
};

const $disabled: ViewStyle = {
  opacity: 0.5,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
