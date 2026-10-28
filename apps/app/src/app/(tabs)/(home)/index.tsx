import type { KeyValue } from "bose-api-speaker-client";
import { Stack, useRouter } from "expo-router";
import {
  Alert,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";

import {
  SPEAKER_SETUP_SUPPORTED,
  useOpenSpeakerSetup,
} from "@/features/onboarding/components/SetupUnavailable";
import { NowPlayingBar } from "@/features/speakers/components/NowPlayingBar";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import type { BoseSpeaker } from "@/features/speakers/hooks/useSpeakerManager";
import {
  canSavePreset,
  findActiveSpeaker,
  hasLoadedMedia,
  isRadioSource,
  isSpeakerPlaying,
  isStandby,
  playStatusLabel,
  trackTitle,
} from "@/features/speakers/lib/playback";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { Button } from "@/ui/ds/Button";
import type { ContextMenuConfig } from "@/ui/ds/ContextMenu";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Shelf } from "@/ui/ds/Shelf";
import { SpeakerCard } from "@/ui/ds/SpeakerCard";
import { Tile } from "@/ui/ds/Tile";
import { nativeIcons } from "@/ui/nativeIcons";
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
    powerToggleMutation,
    selectSourceMutation,
    savePresetMutation,
  } = useBose();
  const openSpeakerSetup = useOpenSpeakerSetup();

  const presetSpeaker = findActiveSpeaker(speakers) ?? speakers[0];

  const openNowPlaying = (speaker: BoseSpeaker) => {
    router.push(
      `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing`,
    );
  };

  const openSettings = (speaker: BoseSpeaker) => {
    router.push(`/speakers/${encodeURIComponent(speaker.deviceID)}/settings`);
  };

  const playPreset = (speaker: BoseSpeaker, slot: number) => {
    haptics.tap();
    keyMutation.mutate({
      deviceID: speaker.deviceID,
      key: `PRESET_${slot}` as KeyValue,
    });
  };

  const speakerMenu = (speaker: BoseSpeaker): ContextMenuConfig => ({
    actions: [
      {
        id: "now-playing",
        title: "Now playing",
        icon: nativeIcons.nowPlaying,
      },
      { id: "settings", title: "Settings", icon: nativeIcons.settings },
      {
        id: "source",
        title: "Source",
        icon: nativeIcons.source,
        actions: [
          {
            id: "source-bluetooth",
            title: "Bluetooth",
            icon: nativeIcons.bluetooth,
            checked: speaker.source === "BLUETOOTH",
          },
          {
            id: "source-aux",
            title: "AUX",
            icon: nativeIcons.aux,
            checked: speaker.source === "AUX",
          },
        ],
      },
      {
        id: "power",
        title: isStandby(speaker) ? "Turn on" : "Turn off",
        icon: nativeIcons.power,
      },
    ],
    onAction: (id) => {
      const { deviceID } = speaker;
      switch (id) {
        case "now-playing":
          openNowPlaying(speaker);
          break;
        case "settings":
          openSettings(speaker);
          break;
        case "source-bluetooth":
          haptics.tap();
          selectSourceMutation.mutate({ deviceID, source: "BLUETOOTH" });
          break;
        case "source-aux":
          haptics.tap();
          selectSourceMutation.mutate({
            deviceID,
            source: "AUX",
            sourceAccount: "AUX",
          });
          break;
        case "power":
          haptics.toggle(isStandby(speaker));
          powerToggleMutation.mutate({ deviceID });
          break;
        default:
          break;
      }
    },
  });

  const savePreset = (speaker: BoseSpeaker, slot: number) => {
    savePresetMutation.mutate(
      { deviceID: speaker.deviceID, presetId: slot },
      {
        onSuccess: () => {
          haptics.success();
        },
        onError: (error) => {
          logger.warn("[Home] Failed to save preset:", error);
          haptics.error();
          Alert.alert(
            "Couldn't save preset",
            `${speaker.name} didn't save Preset ${slot}. Try again.`,
          );
        },
      },
    );
  };

  const presetMenu = (
    speaker: BoseSpeaker,
    slot: number,
    isEmpty: boolean,
  ): ContextMenuConfig => ({
    actions: [
      ...(isEmpty
        ? []
        : [{ id: "play", title: "Play", icon: nativeIcons.play }]),
      {
        id: "save",
        title: isEmpty
          ? "Save current track here"
          : "Replace with current track",
        icon: nativeIcons.save,
        disabled: !canSavePreset(speaker),
      },
    ],
    onAction: (id) => {
      if (id === "play") {
        playPreset(speaker, slot);
      } else {
        savePreset(speaker, slot);
      }
    },
  });

  return (
    <Screen footer={<NowPlayingBar />}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={nativeIcons.add}
          accessibilityLabel="Add speaker"
          hidden={!SPEAKER_SETUP_SUPPORTED}
          onPress={openSpeakerSetup}
        />
      </Stack.Toolbar>
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
            progressBackgroundColor={color.surface2}
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
                    nowPlaying={hasMedia ? trackTitle(speaker) : undefined}
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
                      haptics.tap();
                      playPauseMutation.mutate({ deviceID: speaker.deviceID });
                    }}
                    onOpen={() => {
                      openNowPlaying(speaker);
                    }}
                    onOpenSettings={() => {
                      openSettings(speaker);
                    }}
                    menu={speakerMenu(speaker)}
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
                      <Tile
                        key={slot}
                        title={`Preset ${slot} · empty`}
                        muted
                        menu={presetMenu(presetSpeaker, slot, true)}
                      />
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
                      menu={presetMenu(presetSpeaker, slot, false)}
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
