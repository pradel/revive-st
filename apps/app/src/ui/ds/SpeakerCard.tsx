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
  /**
   * A remembered speaker not reached yet (`connecting`) or that didn't answer
   * (`offline`): its controls are dimmed and inactive, and tapping an offline
   * one tries it again (`onRetry`).
   */
  status?: "connecting" | "offline";
  onRetry?: () => void;
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
  status,
  onRetry,
}: SpeakerCardProps) {
  const volumeDraft = useSliderDraft(volume, onVolumeCommit);
  // `Link asChild` takes only a flat style object (no function or array), so
  // the pressed state is tracked here.
  const [isPressed, setIsPressed] = useState(false);
  const reachable = status === undefined;
  const statusLine =
    status === "connecting"
      ? "Connecting…"
      : status === "offline"
        ? "Offline · Tap to try again"
        : (nowPlaying ?? "Nothing playing");

  const artworkView = (
    <Artwork
      uri={reachable ? artworkUri : null}
      title={nowPlaying ?? name}
      size={artwork.card}
      radius={radius.sm}
      fallbackIcon={nowPlaying ? icons.music : icons.speaker}
      fallbackDrawing={nowPlaying ? undefined : modelDrawing}
    />
  );

  const content = (
    <>
      {/* The zoom into the player needs the `Link` only reachable cards have. */}
      {reachable ? <Link.AppleZoom>{artworkView}</Link.AppleZoom> : artworkView}
      <View style={$text}>
        <Text variant="headline" numberOfLines={1}>
          {name}
        </Text>
        <Text
          variant="subhead"
          color={reachable && nowPlaying ? "textSecondary" : "textTertiary"}
          numberOfLines={1}
        >
          {statusLine}
        </Text>
        {reachable && detail ? (
          <Text variant="caption" color="textTertiary" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </>
  );

  const pressHandlers = {
    onPressIn: () => {
      setIsPressed(true);
    },
    onPressOut: () => {
      setIsPressed(false);
    },
  };

  const renderMain = (triggerProps?: ContextMenuTriggerProps) => {
    if (status === "connecting") {
      return (
        <View
          accessible
          accessibilityLabel={`${name}, connecting`}
          style={$main}
        >
          {content}
        </View>
      );
    }
    if (status === "offline") {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, offline`}
          accessibilityHint="Tries to reach the speaker again"
          {...triggerProps}
          onPress={onRetry}
          // Its own pressed state: the card swaps this for a plain view while
          // connecting, which would leave a tracked press stuck on.
          style={({ pressed }) => (pressed ? $mainPressed : $main)}
        >
          {content}
        </Pressable>
      );
    }
    return (
      <Link href={playerHref} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${nowPlaying ?? "Nothing playing"}`}
          accessibilityHint="Opens the player"
          {...triggerProps}
          {...pressHandlers}
          style={isPressed ? $mainPressed : $main}
        >
          {content}
        </Pressable>
      </Link>
    );
  };

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
        {reachable ? (
          <IconButton
            icon={icons.settings}
            accessibilityLabel={`${name} settings`}
            onPress={onOpenSettings}
          />
        ) : null}
      </View>

      {/* Kept while not reachable, dimmed, so the card doesn't change height. */}
      <View
        style={[$controls, !reachable && $inactive]}
        pointerEvents={reachable ? "auto" : "none"}
        accessibilityElementsHidden={!reachable}
        importantForAccessibility={reachable ? "auto" : "no-hide-descendants"}
      >
        <IconButton
          icon={isPlaying ? icons.pause : icons.play}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
          variant="filled"
          onPress={onPlayPause}
          disabled={!reachable || !canPlayPause}
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
          {reachable ? String(volumeDraft.value) : "–"}
        </Text>
      </View>
    </View>
  );
}

const $inactive: ViewStyle = {
  opacity: 0.35,
};

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
