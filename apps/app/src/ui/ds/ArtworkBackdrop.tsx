import { Image } from "expo-image";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { color } from "@/ui/tokens";

/**
 * Artwork blurred to fill its parent, behind a player, a card or the mini
 * player. Darkened by the scrim so text on it stays readable, unless glass
 * goes on top instead (`scrim={false}`).
 */
export function ArtworkBackdrop({
  uri,
  blurRadius = 40,
  scrim = true,
}: {
  uri: string;
  blurRadius?: number;
  scrim?: boolean;
}) {
  return (
    <>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={blurRadius}
        transition={300}
      />
      {scrim ? <View style={$scrim} /> : null}
    </>
  );
}

const $scrim: ViewStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: color.scrim,
};
