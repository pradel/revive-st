import { Pressable, View, type ViewStyle } from "react-native";

import { color, radius, space } from "@/ui/tokens";

import { Text } from "./Text";

export interface ChipProps {
  label: string;
  selected?: boolean;
  /** Omit for a static, non-interactive chip (e.g. a source badge). */
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const content = (
    <Text variant="subhead" color={selected ? "onAccent" : "textPrimary"}>
      {label}
    </Text>
  );

  if (!onPress) {
    return <View style={[$base, selected && $selected]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        $base,
        selected && $selected,
        pressed && $pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const $base: ViewStyle = {
  alignSelf: "flex-start",
  paddingHorizontal: space.sm,
  paddingVertical: 6,
  borderRadius: radius.pill,
  backgroundColor: color.surface2,
};

const $selected: ViewStyle = {
  backgroundColor: color.accent,
};

const $pressed: ViewStyle = {
  opacity: 0.7,
};
