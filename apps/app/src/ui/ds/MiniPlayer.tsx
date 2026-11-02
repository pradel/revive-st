import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

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
  /** Omitted when the speaker has nothing to play or pause. */
  onPlayPause?: () => void;
  /** Opens the speaker picker; omitted with a single speaker. */
  onChooseSpeaker?: () => void;
  /** Other speakers playing, counted on the speaker button. */
  othersPlaying?: number;
  /**
   * `floating` draws its own card above the tabs; `docked` is a full-width
   * strip on the tab bar's surface, attached to its top (Android);
   * `accessory` and `inline` sit in the iOS tab bar accessory, which supplies
   * the glass background (`inline` is the compact version beside a minimized
   * tab bar).
   */
  variant?: "floating" | "docked" | "accessory" | "inline";
}

const accessoryArtwork = 32;
const dockedArtwork = 40;

export function MiniPlayer({
  title,
  subtitle,
  artworkUri,
  isPlaying,
  playerHref,
  onPlayPause,
  onChooseSpeaker,
  othersPlaying = 0,
  variant = "floating",
}: MiniPlayerProps) {
  const floating = variant === "floating";
  const docked = variant === "docked";
  const ownsBackground = floating || docked;
  // `Link asChild` takes only a flat style object, so the pressed state is
  // tracked here.
  const [isPressed, setIsPressed] = useState(false);
  // The open-player area and the buttons are siblings so screen readers can
  // focus each one.
  return (
    <View
      style={floating ? $wrapper : docked ? $dockedWrapper : $accessoryWrapper}
    >
      <View style={[$row, floating && $bar, docked && $dockedRow]}>
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
              ...(ownsBackground ? undefined : $openAccessory),
              ...(docked ? $openDocked : undefined),
              ...(isPressed ? $pressed : undefined),
            }}
          >
            {variant === "inline" ? null : (
              <Link.AppleZoom>
                <Artwork
                  uri={artworkUri}
                  title={title}
                  size={
                    floating
                      ? artwork.row
                      : docked
                        ? dockedArtwork
                        : accessoryArtwork
                  }
                  radius={ownsBackground ? radius.xs : accessoryArtwork / 2}
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
        {onChooseSpeaker && variant !== "inline" ? (
          <View>
            <IconButton
              icon={icons.speaker}
              accessibilityLabel={
                othersPlaying > 0
                  ? `Choose speaker, ${othersPlaying} other${othersPlaying === 1 ? "" : "s"} playing`
                  : "Choose speaker"
              }
              onPress={onChooseSpeaker}
              tint="textPrimary"
              iconSize={ownsBackground ? 20 : 16}
            />
            {othersPlaying > 0 ? (
              <View style={$badge} pointerEvents="none">
                <Text variant="caption" color="onAccent">
                  {String(othersPlaying)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {onPlayPause ? (
          <IconButton
            icon={isPlaying ? icons.pause : icons.play}
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            onPress={onPlayPause}
            tint="textPrimary"
            iconSize={ownsBackground ? 22 : 18}
          />
        ) : null}
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

/** Flush with the tab bar below: same surface, hairlines above and between. */
const $dockedWrapper: ViewStyle = {
  backgroundColor: color.surface1,
  borderTopWidth: StyleSheet.hairlineWidth,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderColor: color.separator,
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

const $dockedRow: ViewStyle = {
  paddingRight: space.xs,
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

const $openDocked: ViewStyle = {
  paddingHorizontal: space.md,
  borderRadius: 0,
};

const $pressed: ViewStyle = {
  backgroundColor: color.surface3,
};

/** Count of other speakers playing, on the speaker button's corner. */
const $badge: ViewStyle = {
  position: "absolute",
  top: 2,
  right: 2,
  minWidth: 16,
  height: 16,
  paddingHorizontal: 4,
  borderRadius: radius.pill,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: color.accent,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};
