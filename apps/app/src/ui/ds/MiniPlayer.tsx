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
  return (
    <View style={$wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${title}, ${subtitle}`}
        accessibilityHint="Opens the player"
        onPress={onPress}
        style={({ pressed }) => [$bar, pressed && $pressed]}
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
        <IconButton
          icon={isPlaying ? icons.pause : icons.play}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          onPress={onPlayPause}
          tint="textPrimary"
          iconSize={22}
        />
      </Pressable>
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
  gap: space.sm,
  padding: space.xs,
  borderRadius: radius.md,
  backgroundColor: color.surface2,
  shadowColor: color.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 8,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface3,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
