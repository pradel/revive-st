import type { KeyValue } from "bose-api-speaker-client";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { PresetStrip } from "@/features/speakers/components/PresetStrip";
import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import {
  hasLoadedMedia,
  isSpeakerPlaying,
  playStatusLabel,
  sourceLabel,
  trackDetail,
  trackTitle,
} from "@/features/speakers/lib/playback";
import { useSelectedSpeaker } from "@/features/speakers/lib/selection";
import { useSpeakers } from "@/features/speakers/registry/store";
import { haptics } from "@/lib/haptics";
import { useSliderDraft } from "@/lib/useSliderDraft";
import { Artwork } from "@/ui/ds/Artwork";
import { Button } from "@/ui/ds/Button";
import { Chip } from "@/ui/ds/Chip";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { Screen } from "@/ui/ds/Screen";
import { Slider } from "@/ui/ds/Slider";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

/** The player of the selected speaker; its name switches to another one. */
export default function NowPlayingModal() {
  const router = useRouter();
  const { volumeMutation, playPauseMutation, keyMutation } =
    useSpeakerCommands();

  const selected = useSelectedSpeaker();
  const { online } = useSpeakers();
  const canSwitch = online.some(
    (speaker) => speaker.deviceID !== selected?.deviceID,
  );
  const speaker = selected?.status === "online" ? selected : undefined;
  const volumeDraft = useSliderDraft(speaker?.volume ?? 0, (volume) => {
    if (speaker) {
      volumeMutation.mutate({ deviceID: speaker.deviceID, volume });
    }
  });

  const chooseSpeaker = () => {
    router.push("/speaker-picker");
  };

  if (!speaker) {
    return (
      <Screen presentation="sheet">
        <EmptyState
          icon={icons.wifiOff}
          title={
            selected?.status === "connecting"
              ? `Connecting to ${selected.name}…`
              : selected
                ? `${selected.name} is offline`
                : "No speaker"
          }
          description="Make sure the speaker is on and on the same Wi-Fi network as your phone."
          actions={
            <>
              {canSwitch ? (
                <Button
                  label="Choose another speaker"
                  onPress={chooseSpeaker}
                />
              ) : null}
              <Button
                label="Close"
                variant="secondary"
                onPress={() => {
                  router.back();
                }}
              />
            </>
          }
        />
      </Screen>
    );
  }

  const isPlaying = isSpeakerPlaying(speaker);
  const hasMusic = hasLoadedMedia(speaker);
  const detail = trackDetail(speaker);

  const sendKey = (key: KeyValue) => {
    haptics.tap();
    keyMutation.mutate({ deviceID: speaker.deviceID, key });
  };

  return (
    <Screen
      presentation="sheet"
      backdrop={
        speaker.artUrl ? (
          <>
            <Image
              source={{ uri: speaker.artUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={60}
              transition={300}
            />
            <View style={$scrim} />
          </>
        ) : null
      }
    >
      <View style={$header}>
        <IconButton
          icon={icons.chevronDown}
          accessibilityLabel="Close player"
          tint="textPrimary"
          onPress={() => {
            router.back();
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${speaker.name}, ${playStatusLabel(speaker)}`}
          accessibilityHint={canSwitch ? "Chooses another speaker" : undefined}
          disabled={!canSwitch}
          onPress={chooseSpeaker}
          hitSlop={8}
          style={({ pressed }) => [$headerTitle, pressed && $headerPressed]}
        >
          <View style={$headerName}>
            <Text variant="subhead" numberOfLines={1}>
              {speaker.name}
            </Text>
            {canSwitch ? (
              <Icon name={icons.chevronDown} size={12} color="textSecondary" />
            ) : null}
          </View>
          <Text variant="caption" color="textSecondary">
            {playStatusLabel(speaker)}
          </Text>
        </Pressable>
        <IconButton
          icon={icons.settings}
          accessibilityLabel={`${speaker.name} settings`}
          tint="textPrimary"
          onPress={() => {
            router.push(
              `/speakers/${encodeURIComponent(speaker.deviceID)}/settings`,
            );
          }}
        />
      </View>

      <View style={$content}>
        <Link.AppleZoomTarget>
          <View style={$artShadow}>
            <Artwork
              uri={hasMusic ? speaker.artUrl : null}
              title={speaker.track ?? speaker.name}
              size="fill"
              radius={radius.lg}
            />
          </View>
        </Link.AppleZoomTarget>

        <View style={$trackInfo}>
          {speaker.source && speaker.source !== "STANDBY" ? (
            <Chip label={sourceLabel(speaker.source)} />
          ) : null}
          <Text variant="title" numberOfLines={1}>
            {hasMusic ? trackTitle(speaker) : "Nothing playing"}
          </Text>
          <Text variant="body" color="textSecondary" numberOfLines={1}>
            {hasMusic
              ? detail || (speaker.track ? "Unknown Artist" : "")
              : "Ready to play"}
          </Text>
        </View>

        <View style={$transport}>
          <IconButton
            icon={icons.previous}
            accessibilityLabel="Previous track"
            tint="textPrimary"
            size={56}
            iconSize={28}
            disabled={!hasMusic}
            onPress={() => {
              sendKey("PREV_TRACK");
            }}
          />
          <IconButton
            icon={isPlaying ? icons.pause : icons.play}
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            variant="accent"
            size={64}
            iconSize={28}
            disabled={!hasMusic}
            onPress={() => {
              haptics.tap();
              playPauseMutation.mutate({ deviceID: speaker.deviceID });
            }}
          />
          <IconButton
            icon={icons.next}
            accessibilityLabel="Next track"
            tint="textPrimary"
            size={56}
            iconSize={28}
            disabled={!hasMusic}
            onPress={() => {
              sendKey("NEXT_TRACK");
            }}
          />
        </View>

        <View style={$volumeRow}>
          <IconButton
            icon={speaker.muteEnabled ? icons.volumeMuted : icons.volume}
            accessibilityLabel={speaker.muteEnabled ? "Unmute" : "Mute"}
            tint={speaker.muteEnabled ? "accent" : "textSecondary"}
            iconSize={18}
            onPress={() => {
              sendKey("MUTE");
            }}
          />
          <Slider
            size="regular"
            draft={volumeDraft}
            minimumValue={0}
            maximumValue={100}
            accessibilityLabel="Volume"
            style={$slider}
          />
          <Text variant="subhead" color="textSecondary" style={$volumeValue}>
            {volumeDraft.value}
          </Text>
        </View>

        <PresetStrip
          presets={speaker.presets ?? []}
          width={undefined}
          onPlay={(slot) => {
            sendKey(`PRESET_${slot}` as KeyValue);
          }}
        />
      </View>
    </Screen>
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

const $header: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: space.xs,
  paddingTop: space.xs,
};

const $headerTitle: ViewStyle = {
  flex: 1,
  alignItems: "center",
};

const $content: ViewStyle = {
  flex: 1,
  justifyContent: "space-evenly",
  paddingHorizontal: space.screen,
  paddingBottom: space.xl,
};

const $artShadow: ViewStyle = {
  borderRadius: radius.lg,
  shadowColor: color.shadow,
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.5,
  shadowRadius: 24,
  elevation: 12,
};

const $trackInfo: ViewStyle = {
  gap: space.xxs,
};

const $transport: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: space.xxl,
};

const $volumeRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
};

const $slider: ViewStyle = {
  flex: 1,
};

const $volumeValue: TextStyle = {
  width: 32,
  textAlign: "right",
};

const $headerPressed: ViewStyle = {
  opacity: 0.6,
};

const $headerName: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
};
