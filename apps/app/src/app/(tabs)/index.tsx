import type { KeyValue } from "bose-api-speaker-client";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";

import { useOpenSpeakerSetup } from "@/features/onboarding/components/SetupUnavailable";
import { NowPlayingBar } from "@/features/speakers/components/NowPlayingBar";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import type { BoseSpeaker } from "@/features/speakers/hooks/useSpeakerManager";
import {
  findPlayingSpeaker,
  hasLoadedMedia,
  isRadioSource,
  isSpeakerPlaying,
  playStatusLabel,
} from "@/features/speakers/lib/playback";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { IconButton } from "@/ui/ds/IconButton";
import { Screen } from "@/ui/ds/Screen";
import { Shelf } from "@/ui/ds/Shelf";
import { SpeakerCard } from "@/ui/ds/SpeakerCard";
import { Tile } from "@/ui/ds/Tile";
import { PulseRing } from "@/ui/PulseRing";
import { color, space } from "@/ui/tokens";

const PRESET_SLOTS = [1, 2, 3, 4, 5, 6] as const;

export default function Index() {
  const router = useRouter();
  const {
    speakers,
    isScanning,
    rescan,
    volumeMutation,
    playPauseMutation,
    keyMutation,
  } = useBose();
  const openSpeakerSetup = useOpenSpeakerSetup();

  const presetSpeaker = findPlayingSpeaker(speakers) ?? speakers[0];

  const openNowPlaying = (speaker: BoseSpeaker) => {
    router.push(
      `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing`,
    );
  };

  const openSettings = (speaker: BoseSpeaker) => {
    router.push(`/speakers/${encodeURIComponent(speaker.deviceID)}/settings`);
  };

  const playPreset = (speaker: BoseSpeaker, slot: number) => {
    keyMutation.mutate({
      deviceID: speaker.deviceID,
      key: `PRESET_${slot}` as KeyValue,
    });
  };

  return (
    <Screen
      title="Speakers"
      actions={
        <IconButton
          icon={icons.add}
          accessibilityLabel="Add speaker"
          variant="filled"
          size={36}
          iconSize={16}
          onPress={openSpeakerSetup}
        />
      }
      footer={<NowPlayingBar />}
    >
      <ScrollView
        contentContainerStyle={[$content, speakers.length === 0 && $centered]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isScanning}
            onRefresh={rescan}
            tintColor={color.textSecondary}
            colors={[color.accent]}
          />
        }
      >
        {speakers.length === 0 ? (
          <EmptyState
            icon={isScanning ? icons.waveform : icons.wifiOff}
            iconDecoration={
              isScanning ? (
                <>
                  <PulseRing delay={0} />
                  <PulseRing delay={800} />
                  <PulseRing delay={1600} />
                </>
              ) : null
            }
            title={isScanning ? "Looking for speakers…" : "No speakers found"}
            description={
              isScanning
                ? "Scanning your local network for Bose SoundTouch speakers."
                : "Make sure your SoundTouch speakers are powered on and on the same Wi-Fi network as your phone."
            }
            actions={
              <>
                <Button
                  label="Set up a speaker"
                  icon={icons.add}
                  onPress={openSpeakerSetup}
                />
                <Button
                  label={isScanning ? "Scanning…" : "Scan again"}
                  variant="secondary"
                  loading={isScanning}
                  onPress={rescan}
                />
              </>
            }
          />
        ) : (
          <>
            <View style={$cards}>
              {speakers.map((speaker) => {
                const hasMedia = hasLoadedMedia(speaker);
                return (
                  <SpeakerCard
                    key={speaker.deviceID}
                    name={speaker.name}
                    nowPlaying={
                      hasMedia ? (speaker.track ?? "Unknown Track") : undefined
                    }
                    detail={[speaker.artist, playStatusLabel(speaker)]
                      .filter(Boolean)
                      .join(" · ")}
                    artworkUri={speaker.artUrl}
                    isPlaying={isSpeakerPlaying(speaker)}
                    canPlayPause={hasMedia}
                    volume={speaker.volume ?? 0}
                    onVolumeCommit={(volume) => {
                      volumeMutation.mutate({
                        deviceID: speaker.deviceID,
                        volume,
                      });
                    }}
                    onPlayPause={() => {
                      playPauseMutation.mutate({ deviceID: speaker.deviceID });
                    }}
                    onOpen={() => {
                      openNowPlaying(speaker);
                    }}
                    onOpenSettings={() => {
                      openSettings(speaker);
                    }}
                  />
                );
              })}
            </View>

            {presetSpeaker?.presets && (
              <Shelf
                title={
                  speakers.length > 1
                    ? `Presets · ${presetSpeaker.name}`
                    : "Presets"
                }
              >
                {PRESET_SLOTS.map((slot) => {
                  const preset = presetSpeaker.presets?.find(
                    (item) => item.id === slot,
                  );
                  if (!preset) {
                    return (
                      <Tile key={slot} title={`Preset ${slot} · empty`} muted />
                    );
                  }
                  return (
                    <Tile
                      key={slot}
                      title={preset.contentItem.itemName}
                      subtitle={`Preset ${slot}`}
                      fallbackIcon={
                        isRadioSource(preset.contentItem.source)
                          ? icons.radio
                          : icons.music
                      }
                      onPress={() => {
                        playPreset(presetSpeaker, slot);
                      }}
                    />
                  );
                })}
              </Shelf>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const $content: ViewStyle = {
  paddingBottom: space.xxl,
};

const $centered: ViewStyle = {
  flexGrow: 1,
  justifyContent: "center",
};

const $cards: ViewStyle = {
  gap: space.sm,
};
