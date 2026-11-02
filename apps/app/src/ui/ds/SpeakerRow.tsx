import { Pressable, View, type ViewStyle } from "react-native";

import { color, radius, space } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import {
  ContextMenu,
  type ContextMenuConfig,
  type ContextMenuTriggerProps,
} from "./ContextMenu";
import { icons } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface SpeakerRowProps {
  name: string;
  /** One line under the name, e.g. "Standby" or "Offline · Tap to try again". */
  detail: string;
  /** The speaker model's drawing. */
  modelDrawing?: number;
  onPress: () => void;
  accessibilityHint: string;
  /** Turns the speaker on; omitted for a speaker that can't be reached. */
  onPowerOn?: () => void;
  /** Long-press menu on the speaker's name. */
  menu?: ContextMenuConfig;
  /** The speaker the app controls: outlined with the accent. */
  selected?: boolean;
}

/**
 * A speaker with nothing to control on Home, in one line: in standby (with
 * a power button) or offline. A `SpeakerCard` takes its place once it's on.
 */
export function SpeakerRow({
  name,
  detail,
  modelDrawing,
  onPress,
  accessibilityHint,
  onPowerOn,
  menu,
  selected = false,
}: SpeakerRowProps) {
  const renderMain = (triggerProps?: ContextMenuTriggerProps) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${detail}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      {...triggerProps}
      style={({ pressed }) => [$main, pressed && $pressed]}
    >
      <Artwork
        uri={null}
        title={name}
        size={40}
        radius={radius.xs}
        fallbackIcon={icons.speaker}
        fallbackDrawing={modelDrawing}
      />
      <View style={$text}>
        <Text variant="headline" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="textTertiary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[$row, selected && $selected]}>
      {menu ? (
        <ContextMenu {...menu} fill>
          {renderMain}
        </ContextMenu>
      ) : (
        renderMain()
      )}
      {onPowerOn ? (
        <IconButton
          icon={icons.power}
          accessibilityLabel={`Turn on ${name}`}
          onPress={onPowerOn}
        />
      ) : null}
    </View>
  );
}

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
  marginHorizontal: space.screen,
  padding: space.xs,
  borderRadius: radius.md,
  // Kept when not selected, so selecting doesn't shift the row.
  borderWidth: 1,
  borderColor: "transparent",
  backgroundColor: color.surface1,
};

const $selected: ViewStyle = {
  borderColor: color.accent,
};

const $main: ViewStyle = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  borderRadius: radius.sm,
};

const $pressed: ViewStyle = {
  opacity: 0.7,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
