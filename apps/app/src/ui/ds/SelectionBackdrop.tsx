import { Image } from "expo-image";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { color } from "@/ui/tokens";

const FADE_MS = 250;

/**
 * Fills a speaker card or row to mark the selected speaker: its artwork,
 * blurred and darkened so text stays readable, or the accent tint when
 * nothing with artwork plays. Fades in and out as the selection moves. Put
 * it first in a container that clips (`overflow: "hidden"`).
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
        <>
          <Image
            source={{ uri: artworkUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={40}
            transition={FADE_MS}
          />
          <View style={$scrim} />
        </>
      ) : (
        <View style={$tint} />
      )}
    </Animated.View>
  );
}

const $fill: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const $scrim: ViewStyle = {
  ...$fill,
  backgroundColor: color.scrim,
};

const $tint: ViewStyle = {
  ...$fill,
  backgroundColor: color.accentMuted,
};
