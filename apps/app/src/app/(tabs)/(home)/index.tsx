import type { KeyValue } from "bose-api-speaker-client";
import { Stack, useRouter } from "expo-router";
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";

import { useOpenSpeakerSetup } from "@/features/onboarding/components/SetupUnavailable";
import { NowPlayingBar } from "@/features/speakers/components/NowPlayingBar";
import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import { speakerDrawing } from "@/features/speakers/lib/drawing";
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
import {
  speakerRegistry,
  useSpeakers,
} from "@/features/speakers/registry/store";
import type { BoseSpeaker } from "@/features/speakers/registry/types";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { Button } from "@/ui/ds/Button";
import type { ContextMenuConfig } from "@/ui/ds/ContextMenu";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Shelf } from "@/ui/ds/Shelf";
import { SpeakerCard } from "@/ui/ds/SpeakerCard";
import { Text } from "@/ui/ds/Text";
import { Tile } from "@/ui/ds/Tile";
import { nativeIcons } from "@/ui/nativeIcons";
import { PulseRing } from "@/ui/PulseRing";
import { color, space } from "@/ui/tokens";

const PRESET_SLOTS = [1, 2, 3, 4, 5, 6] as const;
type PresetSlot = (typeof PRESET_SLOTS)[number];

/**
 * iOS can't tell the app that Local Network access was refused: scans just
 * find nothing. Wherever no speaker answers, this says where to turn it on.
 */
const LOCAL_NETWORK_HINT =
  Platform.OS === "ios"
    ? " If you didn't allow Local Network access, turn it on in Settings."
    : "";

const openAppSettings = () => {
  void Linking.openSettings();
};

export default function Index() {
  const router = useRouter();
  const { online: speakers, listed: listedSpeakers, scan } = useSpeakers();
  const isScanning = scan !== null;
  const {
    volumeMutation,
    playPauseMutation,
    keyMutation,
    powerToggleMutation,
    selectSourceMutation,
    savePresetMutation,
  } = useSpeakerCommands();
  const openSpeakerSetup = useOpenSpeakerSetup();

  const presetSpeaker = findActiveSpeaker(speakers) ?? speakers[0];

  const playerHref = (speaker: BoseSpeaker) =>
    `/speakers/${encodeURIComponent(speaker.deviceID)}/now-playing` as const;

  const openNowPlaying = (speaker: BoseSpeaker) => {
    router.push(playerHref(speaker));
  };

  const openSettings = (speaker: BoseSpeaker) => {
    router.push(`/speakers/${encodeURIComponent(speaker.deviceID)}/settings`);
  };

  const playPreset = (speaker: BoseSpeaker, slot: PresetSlot) => {
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

  const unreachableMenu = (speaker: BoseSpeaker): ContextMenuConfig => ({
    actions: [
      { id: "retry", title: "Try again", icon: nativeIcons.refresh },
      {
        id: "forget",
        title: "Forget speaker",
        icon: nativeIcons.delete,
        destructive: true,
      },
    ],
    onAction: (id) => {
      if (id === "retry") {
        speakerRegistry.retry(speaker.deviceID);
      } else {
        speakerRegistry.forget(speaker.deviceID);
      }
    },
  });

  const allOffline =
    !isScanning &&
    listedSpeakers.length > 0 &&
    listedSpeakers.every((speaker) => speaker.status === "offline");

  const savePreset = (speaker: BoseSpeaker, slot: PresetSlot) => {
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
    slot: PresetSlot,
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
    <Screen inTabs footer={<NowPlayingBar />}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={nativeIcons.add}
          accessibilityLabel="Add speaker"
          onPress={openSpeakerSetup}
        />
      </Stack.Toolbar>
      <ScrollView
        contentContainerStyle={[
          $content,
          listedSpeakers.length === 0 && $centered,
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          // Only a scan the user asked for shows the spinner: the automatic
          // one at launch would push the list down while it's already shown.
          <RefreshControl
            refreshing={scan === "user"}
            onRefresh={() => {
              speakerRegistry.rescan();
            }}
            tintColor={color.textSecondary}
            colors={[color.accent]}
            progressBackgroundColor={color.surface2}
          />
        }
      >
        {listedSpeakers.length === 0 ? (
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
                : `Make sure your SoundTouch speakers are powered on and on the same Wi-Fi network as your phone.${LOCAL_NETWORK_HINT}`
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
                  onPress={() => {
                    speakerRegistry.rescan();
                  }}
                />
                {LOCAL_NETWORK_HINT ? (
                  <Button
                    label="Open Settings"
                    variant="ghost"
                    onPress={openAppSettings}
                  />
                ) : null}
              </>
            }
          />
        ) : (
          <>
            <View style={$cards}>
              {listedSpeakers.map((speaker) => {
                const hasMedia = hasLoadedMedia(speaker);
                const reachable = speaker.status === "online";
                return (
                  <SpeakerCard
                    key={speaker.deviceID}
                    name={speaker.name}
                    status={
                      speaker.status === "online" ? undefined : speaker.status
                    }
                    onRetry={() => {
                      haptics.tap();
                      speakerRegistry.retry(speaker.deviceID);
                    }}
                    nowPlaying={hasMedia ? trackTitle(speaker) : undefined}
                    detail={[speaker.artist, playStatusLabel(speaker)]
                      .filter(Boolean)
                      .join(" · ")}
                    artworkUri={speaker.artUrl}
                    modelDrawing={speakerDrawing(speaker.type)}
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
                    playerHref={playerHref(speaker)}
                    onOpenSettings={() => {
                      openSettings(speaker);
                    }}
                    menu={
                      reachable
                        ? speakerMenu(speaker)
                        : speaker.status === "offline"
                          ? unreachableMenu(speaker)
                          : undefined
                    }
                  />
                );
              })}
            </View>

            {allOffline ? (
              <View style={$offlineHint}>
                <Text variant="subhead" color="textSecondary">
                  {`Can't reach your speakers. Make sure they're on and on the same Wi-Fi network as your phone.${LOCAL_NETWORK_HINT}`}
                </Text>
                {LOCAL_NETWORK_HINT ? (
                  <Button
                    label="Open Settings"
                    variant="secondary"
                    onPress={openAppSettings}
                  />
                ) : null}
              </View>
            ) : null}

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
                        title="Empty"
                        subtitle={`Preset ${slot}`}
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
                      artworkUri={preset.contentItem.containerArt || null}
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

const $offlineHint: ViewStyle = {
  marginHorizontal: space.screen,
  marginTop: space.md,
  gap: space.sm,
};
