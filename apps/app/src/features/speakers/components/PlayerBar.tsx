import { MenuView } from "@expo/ui/community/menu";
import { Pressable, View, type ViewStyle } from "react-native";

import { Icon, icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

import type { PlayerBarProps } from "./PlayerBar.types";
import { SWITCHABLE_SOURCES } from "./sources";

const CONTROL = 48;

/**
 * Round tonal buttons and a pill, as Material lays out a player's secondary
 * actions; the source button opens a Material dropdown.
 */
export function PlayerBar({
  speakerName,
  currentSource,
  onSelectSource,
  onChooseSpeaker,
  onOpenSettings,
}: PlayerBarProps) {
  return (
    <View style={$bar}>
      <MenuView
        actions={SWITCHABLE_SOURCES.map((source) => ({
          id: source.id,
          title: source.title,
          image: source.icon,
          state: source.id === currentSource ? "on" : "off",
        }))}
        onPressAction={({ nativeEvent }) => {
          const source = SWITCHABLE_SOURCES.find(
            (item) => item.id === nativeEvent.event,
          );
          if (source) {
            onSelectSource(source);
          }
        }}
      >
        <View
          style={$round}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Source"
        >
          <Icon name={icons.source} size={22} color="textPrimary" />
        </View>
      </MenuView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${speakerName}, choose another speaker`}
        onPress={onChooseSpeaker}
        style={({ pressed }) => [$pill, pressed && $pressed]}
      >
        <Icon name={icons.speaker} size={18} color="textPrimary" />
        <Text variant="subhead" numberOfLines={1} style={$pillText}>
          {speakerName}
        </Text>
      </Pressable>
      <IconButton
        icon={icons.settings}
        accessibilityLabel="Speaker settings"
        variant="filled"
        tint="textPrimary"
        size={CONTROL}
        iconSize={22}
        onPress={onOpenSettings}
      />
    </View>
  );
}

const $bar: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space.sm,
};

const $round: ViewStyle = {
  width: CONTROL,
  height: CONTROL,
  borderRadius: radius.pill,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: color.surface2,
};

const $pill: ViewStyle = {
  flexShrink: 1,
  height: CONTROL,
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
  paddingHorizontal: space.md,
  borderRadius: radius.pill,
  backgroundColor: color.surface2,
};

const $pillText: ViewStyle = {
  flexShrink: 1,
};

const $pressed: ViewStyle = {
  opacity: 0.7,
};
