import { Pressable, View, type ViewStyle } from "react-native";

import { artwork, color, radius, space } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import { icons } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface MiniPlayerProps {
  title: string;
  subtitle: string;
  artworkUri?: string | null;
  isPlaying: boolean;
  onPress: () => void;
  onPlayPause: () => void;
}

export function MiniPlayer({
  title,
  subtitle,
  artworkUri,
  isPlaying,
  onPress,
  onPlayPause,
}: MiniPlayerProps) {
  // The open-player area and the play/pause button are siblings so screen
  // readers can focus each one.
  return (
    <View style={$wrapper}>
      <View style={$bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Now playing: ${title}, ${subtitle}`}
          accessibilityHint="Opens the player"
          onPress={onPress}
          style={({ pressed }) => [$open, pressed && $pressed]}
        >
          <Artwork
            uri={artworkUri}
            title={title}
            size={artwork.row}
            radius={radius.xs}
          />
          <View style={$text}>
            <Text variant="subhead" color="textPrimary" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </Pressable>
        <IconButton
          icon={isPlaying ? icons.pause : icons.play}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          onPress={onPlayPause}
          tint="textPrimary"
          iconSize={22}
        />
      </View>
    </View>
  );
}

const $wrapper: ViewStyle = {
  paddingHorizontal: space.xs,
  paddingBottom: space.xs,
};

const $bar: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
  paddingRight: space.xs,
  borderRadius: radius.md,
  backgroundColor: color.surface2,
  shadowColor: color.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
};

const $open: ViewStyle = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  padding: space.xs,
  borderRadius: radius.md,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface3,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
