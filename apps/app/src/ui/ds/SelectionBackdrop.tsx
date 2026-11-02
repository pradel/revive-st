import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { color } from "@/ui/tokens";

import { ArtworkBackdrop } from "./ArtworkBackdrop";

const FADE_MS = 250;

/**
 * Fills a speaker card or row to mark the selected speaker: its artwork
 * (`ArtworkBackdrop`), or the accent tint when nothing with artwork plays.
 * Fades in and out as the selection moves. Put it first in a container that
 * clips (`overflow: "hidden"`).
 */
export function SelectionBackdrop({
  artworkUri,
}: {
  artworkUri?: string | null;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(FADE_MS)}
      exiting={FadeOut.duration(FADE_MS)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {artworkUri ? (
        <ArtworkBackdrop uri={artworkUri} />
      ) : (
        <View style={$tint} />
      )}
    </Animated.View>
  );
}

const $tint: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: color.accentMuted,
};
