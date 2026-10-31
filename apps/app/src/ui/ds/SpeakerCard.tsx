import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, View, type TextStyle, type ViewStyle } from "react-native";

import { useSliderDraft } from "@/lib/useSliderDraft";
import { artwork, color, radius, space } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import {
  ContextMenu,
  type ContextMenuConfig,
  type ContextMenuTriggerProps,
} from "./ContextMenu";
import { Icon, icons } from "./Icon";
import { IconButton } from "./IconButton";
import { Slider } from "./Slider";
import { Text } from "./Text";

export interface SpeakerCardProps {
  name: string;
  /** Track/station line; omit when nothing is loaded ("Nothing playing"). */
  nowPlaying?: string;
  /** Secondary line under the track, e.g. artist or play status. */
  detail?: string;
  artworkUri?: string | null;
  /** The speaker model's drawing, shown while nothing is playing. */
  modelDrawing?: number;
  isPlaying: boolean;
  /** Disables play/pause when the speaker has nothing to resume. */
  canPlayPause: boolean;
  volume: number;
  /** Sends the volume when a drag ends. */
  onVolumeCommit: (volume: number) => void;
  onPlayPause: () => void;
  /** The player; on iOS 18+ it zooms open from the artwork. */
  playerHref: Href;
  onOpenSettings: () => void;
  /** Long-press menu on the speaker's artwork and name. */
  menu?: ContextMenuConfig;
}

export function SpeakerCard({
  name,
  nowPlaying,
  detail,
  artworkUri,
  modelDrawing,
  isPlaying,
  canPlayPause,
  volume,
  onVolumeCommit,
  onPlayPause,
  playerHref,
  onOpenSettings,
  menu,
}: SpeakerCardProps) {
  const volumeDraft = useSliderDraft(volume, onVolumeCommit);
  // `Link asChild` takes only a flat style object (no function or array), so
  // the pressed state is tracked here.
  const [isPressed, setIsPressed] = useState(false);

  const renderMain = (triggerProps?: ContextMenuTriggerProps) => (
    <Link href={playerHref} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${nowPlaying ?? "Nothing playing"}`}
        accessibilityHint="Opens the player"
        {...triggerProps}
        onPressIn={() => {
          setIsPressed(true);
        }}
        onPressOut={() => {
          setIsPressed(false);
        }}
        style={isPressed ? $mainPressed : $main}
      >
        <Link.AppleZoom>
          <Artwork
            uri={artworkUri}
            title={nowPlaying ?? name}
            size={artwork.card}
            radius={radius.sm}
            fallbackIcon={nowPlaying ? icons.music : icons.speaker}
            fallbackDrawing={nowPlaying ? undefined : modelDrawing}
          />
        </Link.AppleZoom>
        <View style={$text}>
          <Text variant="headline" numberOfLines={1}>
            {name}
          </Text>
          <Text
            variant="subhead"
            color={nowPlaying ? "textSecondary" : "textTertiary"}
            numberOfLines={1}
          >
            {nowPlaying ?? "Nothing playing"}
          </Text>
          {detail ? (
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );

  return (
    <View style={$card}>
      <View style={$top}>
        {menu ? (
          <ContextMenu {...menu} fill>
            {renderMain}
          </ContextMenu>
        ) : (
          renderMain()
        )}
        <IconButton
          icon={icons.settings}
          accessibilityLabel={`${name} settings`}
          onPress={onOpenSettings}
        />
      </View>

      <View style={$controls}>
        <IconButton
          icon={isPlaying ? icons.pause : icons.play}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          variant="filled"
          onPress={onPlayPause}
          disabled={!canPlayPause}
          iconSize={18}
        />
        <Icon name={icons.volume} size={16} />
        <Slider
          draft={volumeDraft}
          minimumValue={0}
          maximumValue={100}
          accessibilityLabel={`${name} volume`}
          style={$slider}
        />
        <Text variant="caption" color="textSecondary" style={$volumeValue}>
          {volumeDraft.value}
        </Text>
      </View>
    </View>
  );
}

const $card: ViewStyle = {
  marginHorizontal: space.screen,
  padding: space.sm,
  gap: space.xs,
  borderRadius: radius.md,
  backgroundColor: color.surface1,
};

const $top: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
};

const $main: ViewStyle = {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  borderRadius: radius.sm,
};

const $mainPressed: ViewStyle = {
  ...$main,
  opacity: 0.7,
};

const $text: ViewStyle = {
  flex: 1,
  gap: 2,
};

const $controls: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
};

const $slider: ViewStyle = {
  flex: 1,
};

/** As wide as the settings button above, so the number sits centred under it. */
const $volumeValue: TextStyle = {
  width: 40,
  textAlign: "center",
};
