import { Image, type ImageStyle } from "expo-image";
import { useState } from "react";
import { View, type ViewStyle } from "react-native";

import { artworkPalette, color, radius as radii } from "@/ui/tokens";

import { Icon, icons, type IconName } from "./Icon";

export interface ArtworkProps {
  /** Remote image; when missing or failing, a tinted placeholder is shown. */
  uri?: string | null;
  /** Seeds the placeholder hue so the same item always gets the same color. */
  title: string;
  /** Side length in points, or `fill` to take the parent's width (square). */
  size: number | "fill";
  radius?: number;
  fallbackIcon?: IconName;
  /**
   * Asset drawn instead of the icon when there's no image (e.g. the speaker's
   * model).
   */
  fallbackDrawing?: number;
}

export function Artwork({
  uri,
  title,
  size,
  radius = radii.xs,
  fallbackIcon = icons.music,
  fallbackDrawing,
}: ArtworkProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && uri !== failedUri;

  const frame: ViewStyle =
    size === "fill"
      ? { width: "100%", aspectRatio: 1, borderRadius: radius }
      : { width: size, height: size, borderRadius: radius };
  const iconSize = size === "fill" ? 72 : Math.max(16, Math.round(size * 0.38));

  return (
    <View
      style={[
        $frame,
        frame,
        {
          backgroundColor:
            !showImage && fallbackDrawing !== undefined
              ? color.surface2
              : placeholderColor(title),
        },
      ]}
      accessibilityIgnoresInvertColors
    >
      {showImage ? (
        <Image
          source={{ uri: uri ?? undefined }}
          style={$image}
          contentFit="cover"
          transition={200}
          recyclingKey={uri}
          onError={() => {
            setFailedUri(uri ?? null);
          }}
        />
      ) : fallbackDrawing === undefined ? (
        <Icon name={fallbackIcon} size={iconSize} color="textSecondary" />
      ) : (
        <Image source={fallbackDrawing} style={$drawing} contentFit="contain" />
      )}
    </View>
  );
}

/** djb2 string hash → stable palette entry. */
export function placeholderColor(seed: string) {
  let hash = 5381;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.trunc(hash * 33 + seed.charCodeAt(index)) % 2_147_483_647;
  }
  return artworkPalette[Math.abs(hash) % artworkPalette.length];
}

const $frame: ViewStyle = {
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
};

const $image: ImageStyle = {
  width: "100%",
  height: "100%",
};

const $drawing: ImageStyle = {
  width: "78%",
  height: "78%",
};
