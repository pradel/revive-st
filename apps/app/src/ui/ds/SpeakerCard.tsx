import { Pressable, View, type TextStyle, type ViewStyle } from "react-native";

import { useDraftValue } from "@/lib/useDraftValue";
import { artwork, color, radius, space } from "@/ui/tokens";

import { Artwork } from "./Artwork";
import { ContextMenu, type ContextMenuConfig } from "./ContextMenu";
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
  isPlaying: boolean;
  /** Disables play/pause when the speaker has nothing to resume. */
  canPlayPause: boolean;
  volume: number;
  /** Sends the volume once a drag settles. */
  onVolumeCommit: (volume: number) => void;
  onPlayPause: () => void;
  onOpen: () => void;
  onOpenSettings: () => void;
  /** Long-press menu on the speaker's artwork and name. */
  menu?: ContextMenuConfig;
}

export function SpeakerCard({
  name,
  nowPlaying,
  detail,
  artworkUri,
  isPlaying,
  canPlayPause,
  volume,
  onVolumeCommit,
  onPlayPause,
  onOpen,
  onOpenSettings,
  menu,
}: SpeakerCardProps) {
  const [draftVolume, setDraftVolume] = useDraftValue(volume, onVolumeCommit);

  const renderMain = (openMenu: (() => void) | undefined) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${nowPlaying ?? "Nothing playing"}`}
      accessibilityHint="Opens the player"
      onPress={onOpen}
      onLongPress={openMenu}
      style={({ pressed }) => [$main, pressed && $pressed]}
    >
      <Artwork
        uri={artworkUri}
        title={nowPlaying ?? name}
        size={artwork.card}
        radius={radius.sm}
        fallbackIcon={nowPlaying ? icons.music : icons.speaker}
      />
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
      <Icon name={icons.chevronRight} size={14} color="textTertiary" />
    </Pressable>
  );

  return (
    <View style={$card}>
      <View style={$top}>
        {menu ? (
          <ContextMenu {...menu} fill>
            {renderMain}
          </ContextMenu>
        ) : (
          renderMain(undefined)
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
          value={draftVolume}
          minimumValue={0}
          maximumValue={100}
          accessibilityLabel={`${name} volume`}
          style={$slider}
          onValueChange={setDraftVolume}
        />
        <Text variant="caption" color="textSecondary" style={$volumeValue}>
          {draftVolume}
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

const $pressed: ViewStyle = {
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

const $volumeValue: TextStyle = {
  width: 28,
  textAlign: "right",
};
