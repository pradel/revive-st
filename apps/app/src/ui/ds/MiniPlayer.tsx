import { Link, type Href } from "expo-router";
import { useState } from "react";
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
  /** The player; on iOS 18+ it zooms open from the artwork. */
  playerHref: Href;
  onPlayPause: () => void;
  /**
   * `floating` draws its own card above the tabs; `accessory` and `inline`
   * sit in the iOS tab bar accessory, which supplies the glass background
   * (`inline` is the compact version beside a minimized tab bar).
   */
  variant?: "floating" | "accessory" | "inline";
}

const accessoryArtwork = 32;

export function MiniPlayer({
  title,
  subtitle,
  artworkUri,
  isPlaying,
  playerHref,
  onPlayPause,
  variant = "floating",
}: MiniPlayerProps) {
  const floating = variant === "floating";
  // `Link asChild` takes only a flat style object, so the pressed state is
  // tracked here.
  const [isPressed, setIsPressed] = useState(false);
  // The open-player area and the play/pause button are siblings so screen
  // readers can focus each one.
  return (
    <View style={floating ? $wrapper : $accessoryWrapper}>
      <View style={[$row, floating && $bar]}>
        <Link href={playerHref} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Now playing: ${title}, ${subtitle}`}
            accessibilityHint="Opens the player"
            onPressIn={() => {
              setIsPressed(true);
            }}
            onPressOut={() => {
              setIsPressed(false);
            }}
            style={{
              ...$open,
              ...(floating ? undefined : $openAccessory),
              ...(isPressed ? $pressed : undefined),
            }}
          >
            {variant === "inline" ? null : (
              <Link.AppleZoom>
                <Artwork
                  uri={artworkUri}
                  title={title}
                  size={floating ? artwork.row : accessoryArtwork}
                  radius={floating ? radius.xs : accessoryArtwork / 2}
                />
              </Link.AppleZoom>
            )}
            <View style={$text}>
              <Text variant="subhead" color="textPrimary" numberOfLines={1}>
                {title}
              </Text>
              {variant === "inline" ? null : (
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        </Link>
        <IconButton
          icon={isPlaying ? icons.pause : icons.play}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          onPress={onPlayPause}
          tint="textPrimary"
          iconSize={floating ? 22 : 18}
        />
      </View>
    </View>
  );
}

const $wrapper: ViewStyle = {
  paddingHorizontal: space.xs,
  paddingBottom: space.xs,
};

const $accessoryWrapper: ViewStyle = {
  flex: 1,
  justifyContent: "center",
  paddingHorizontal: space.xxs,
};

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
};

const $bar: ViewStyle = {
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

const $openAccessory: ViewStyle = {
  paddingVertical: 0,
  paddingHorizontal: space.xxs,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface3,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
