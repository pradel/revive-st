import type { KeyValue } from "bose-api-speaker-client";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Slider } from "@/components/ui/Slider";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import {
  hasLoadedMedia,
  isSpeakerPlaying,
  playStatusLabel,
  sourceLabel,
  trackDetail,
} from "@/features/speakers/lib/playback";
import { Artwork } from "@/ui/ds/Artwork";
import { Button } from "@/ui/ds/Button";
import { Chip } from "@/ui/ds/Chip";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

const PRESET_SLOTS = [1, 2, 3, 4, 5, 6] as const;

export default function NowPlayingModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { speakers, volumeMutation, playPauseMutation, keyMutation } =
    useBose();

  const speaker = speakers.find((s) => s.deviceID === id);
  const [localVolume, setLocalVolume] = useState<number | null>(null);

  if (!speaker) {
    return (
      <Screen>
        <EmptyState
          icon={icons.wifiOff}
          title="Speaker not found"
          description="This speaker is no longer detected on your local network."
          actions={
            <Button
              label="Close"
              variant="secondary"
              onPress={() => {
                router.back();
              }}
            />
          }
        />
      </Screen>
    );
  }

  const isPlaying = isSpeakerPlaying(speaker);
  const hasMusic = hasLoadedMedia(speaker);
  const volume = speaker.volume ?? 0;
  const displayVolume = localVolume ?? volume;
  const detail = trackDetail(speaker);

  const sendKey = (key: KeyValue) => {
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
        <View style={$headerTitle}>
          <Text variant="subhead" numberOfLines={1}>
            {speaker.name}
          </Text>
          <Text variant="caption" color="textSecondary">
            {playStatusLabel(speaker)}
          </Text>
        </View>
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
        <View style={$artShadow}>
          <Artwork
            uri={hasMusic ? speaker.artUrl : null}
            title={speaker.track ?? speaker.name}
            size="fill"
            radius={radius.lg}
          />
        </View>

        <View style={$trackInfo}>
          {speaker.source && speaker.source !== "STANDBY" ? (
            <Chip label={sourceLabel(speaker.source)} />
          ) : null}
          <Text variant="title" numberOfLines={1}>
            {hasMusic ? (speaker.track ?? "Unknown Track") : "Nothing playing"}
          </Text>
          <Text variant="body" color="textSecondary" numberOfLines={1}>
            {hasMusic ? detail || "Unknown Artist" : "Ready to play"}
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
          <View style={$slider}>
            <Slider
              value={volume}
              minimumValue={0}
              maximumValue={100}
              trackHeight={6}
              thumbSize={18}
              trackColor={color.surface3}
              fillColor={color.textPrimary}
              thumbColor={color.textPrimary}
              onValueChange={(val) => {
                setLocalVolume(Math.round(val));
              }}
              onSlidingComplete={(val) => {
                setLocalVolume(null);
                volumeMutation.mutate({
                  deviceID: speaker.deviceID,
                  volume: val,
                });
              }}
            />
          </View>
          <Text variant="subhead" color="textSecondary" style={$volumeValue}>
            {displayVolume}
          </Text>
        </View>

        <View style={$presets}>
          {PRESET_SLOTS.map((slot) => {
            const preset = speaker.presets?.find((item) => item.id === slot);
            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                accessibilityLabel={
                  preset
                    ? `Preset ${slot}: ${preset.contentItem.itemName}`
                    : `Preset ${slot}, empty`
                }
                disabled={!preset}
                onPress={() => {
                  sendKey(`PRESET_${slot}` as KeyValue);
                }}
                style={({ pressed }) => [
                  $presetKey,
                  preset ? $presetFilled : null,
                  pressed && $presetPressed,
                ]}
              >
                <Text
                  variant="headline"
                  color={preset ? "textPrimary" : "textTertiary"}
                >
                  {slot}
                </Text>
              </Pressable>
            );
          })}
        </View>
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

const $presets: ViewStyle = {
  flexDirection: "row",
  gap: space.xs,
};

const $presetKey: ViewStyle = {
  flex: 1,
  aspectRatio: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.sm,
  backgroundColor: color.surface1,
};

const $presetFilled: ViewStyle = {
  backgroundColor: color.surface2,
};

const $presetPressed: ViewStyle = {
  backgroundColor: color.surface3,
};
