import { Pressable, View, type ViewStyle } from "react-native";

import { artwork, radius } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import {
  ContextMenu,
  type ContextMenuConfig,
  type ContextMenuTriggerProps,
} from "./ContextMenu";
import type { IconName } from "./Icon";
import { Text } from "./Text";

export interface TileProps {
  title: string;
  subtitle?: string;
  artworkUri?: string | null;
  fallbackIcon?: IconName;
  onPress?: () => void;
  /** Long-press menu, e.g. to save a preset. */
  menu?: ContextMenuConfig;
  /** Dims the tile, e.g. for an empty preset slot. */
  muted?: boolean;
}

export function Tile({
  title,
  subtitle,
  artworkUri,
  fallbackIcon,
  onPress,
  menu,
  muted = false,
}: TileProps) {
  const renderTile = (triggerProps?: ContextMenuTriggerProps) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      {...triggerProps}
      disabled={!onPress && !menu}
      style={({ pressed }) => [$tile, (pressed || muted) && $dimmed]}
    >
      <Artwork
        uri={artworkUri}
        title={title}
        size={artwork.tile}
        radius={radius.sm}
        fallbackIcon={fallbackIcon}
      />
      <View style={$caption}>
        <Text
          variant="subhead"
          color="textPrimary"
          numberOfLines={subtitle ? 1 : 2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return menu ? (
    <ContextMenu {...menu}>{renderTile}</ContextMenu>
  ) : (
    renderTile()
  );
}

const $tile: ViewStyle = {
  width: artwork.tile,
};

const $caption: ViewStyle = {
  paddingTop: 6,
};

const $dimmed: ViewStyle = {
  opacity: 0.55,
};
