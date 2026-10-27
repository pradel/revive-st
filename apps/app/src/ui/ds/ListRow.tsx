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
  return (
    <Pressable
      accessibilityRole={isRadio ? "radio" : onPress ? "button" : undefined}
      accessibilityState={isRadio ? { disabled, selected } : { disabled }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        $row,
        selected === true && $selected,
        pressed && $pressed,
        disabled && $disabled,
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
      {trailing}
    </Pressable>
  );
}

const $row: ViewStyle = {
  minHeight: 64,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  paddingHorizontal: space.screen,
  paddingVertical: space.xs,
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
