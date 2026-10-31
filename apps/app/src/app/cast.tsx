import { ApiError } from "bose-api-speaker-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { countStationClick } from "@/features/radio/lib/radio-browser";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import {
  useMargeAPIStatusQuery,
  type BoseSpeaker,
} from "@/features/speakers/hooks/useSpeakerManager";
import {
  radioBrowserLocation,
  StationNotStartedError,
} from "@/features/speakers/lib/radio";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { artwork, color, radius, space } from "@/ui/tokens";

/** Play the station now, or store it on one of the speaker's presets. */
type Mode = "play" | "preset";

const PRESET_SLOTS = [1, 2, 3, 4, 5, 6] as const;
type PresetSlot = (typeof PRESET_SLOTS)[number];

/**
 * "Play on…" and "Save to preset" sheet for a radio station: picks a speaker,
 * then plays the station on it or stores it on one of its six presets.
 */
export default function CastSheet() {
  const router = useRouter();
  const {
    mode = "play",
    stationuuid,
    name,
    favicon,
  } = useLocalSearchParams<{
    stationuuid: string;
    name: string;
    favicon: string;
    mode?: Mode;
  }>();
  const station = { stationuuid, name, favicon: favicon ?? "" };
  const { speakers, playStationMutation, storeStationPresetMutation } =
    useBose();
  const [castingToSpeakerId, setCastingToSpeakerId] = useState<string | null>(
    null,
  );
  const [chosenSpeakerId, setChosenSpeakerId] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState<PresetSlot | null>(null);
  const [castError, setCastError] = useState<string | null>(null);

  // The cast can finish after the user has already closed the sheet; going
  // back then would pop whatever screen is now on top.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // With a single speaker, saving goes straight to its presets.
  const presetSpeaker =
    mode === "preset"
      ? speakers.find(
          (speaker) =>
            speaker.deviceID ===
            (chosenSpeakerId ??
              (speakers.length === 1 ? speakers[0].deviceID : null)),
        )
      : undefined;

  const castToSpeaker = async (speaker: BoseSpeaker) => {
    setCastError(null);
    setCastingToSpeakerId(speaker.deviceID);
    logger.info(`[cast] Casting ${name} to ${speaker.host}`);
    try {
      await playStationMutation.mutateAsync({
        deviceID: speaker.deviceID,
        station,
      });
      // Success shows up in the mini player; no need to interrupt.
      haptics.success();
      countStationClick(stationuuid).catch((err: unknown) => {
        logger.warn("[cast] Couldn't count the station's play", err);
      });
      if (mountedRef.current) {
        router.back();
      }
    } catch (err) {
      logger.error(err);
      haptics.error();
      setCastError(sheetErrorMessage(err, speaker.name, mode));
    } finally {
      setCastingToSpeakerId(null);
    }
  };

  const storeInSlot = async (speaker: BoseSpeaker, slot: PresetSlot) => {
    setCastError(null);
    setSavingSlot(slot);
    logger.info(`[cast] Saving ${name} to preset ${slot} on ${speaker.host}`);
    try {
      await storeStationPresetMutation.mutateAsync({
        deviceID: speaker.deviceID,
        presetId: slot,
        station,
      });
      haptics.success();
      if (mountedRef.current) {
        router.back();
      }
    } catch (err) {
      logger.error(err);
      haptics.error();
      setCastError(sheetErrorMessage(err, speaker.name, mode));
    } finally {
      setSavingSlot(null);
    }
  };

  const chooseSlot = (speaker: BoseSpeaker, slot: PresetSlot) => {
    const current = speaker.presets?.find((preset) => preset.id === slot);
    // A speaker keeps a station on one preset only: storing it on another
    // moves it there and empties the one it was on.
    const savedOn = speaker.presets?.find(
      (preset) =>
        preset.contentItem.location === radioBrowserLocation(stationuuid),
    )?.id;
    const consequences = [
      current && `"${current.contentItem.itemName}" will be replaced.`,
      savedOn !== undefined &&
        `"${name}" moves from preset ${savedOn}, which becomes empty.`,
    ].filter(Boolean);
    if (consequences.length === 0) {
      void storeInSlot(speaker, slot);
      return;
    }
    Alert.alert(
      current ? `Replace preset ${slot}?` : `Move to preset ${slot}?`,
      consequences.join(" "),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: current ? "Replace" : "Move",
          style: current ? "destructive" : "default",
          onPress: () => {
            void storeInSlot(speaker, slot);
          },
        },
      ],
    );
  };

  const askToConfigure = (speaker: BoseSpeaker) => {
    Alert.alert(
      "Configuration required",
      `${speaker.name} must be configured for the Marge API before it can play internet radio.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Configure",
          onPress: () => {
            router.back();
            router.push(
              `/speakers/${encodeURIComponent(speaker.deviceID)}/settings`,
            );
          },
        },
      ],
    );
  };

  const renderBody = () => {
    if (presetSpeaker) {
      return (
        <View>
          {PRESET_SLOTS.map((slot) => {
            const preset = presetSpeaker.presets?.find(
              (entry) => entry.id === slot,
            );
            const holdsStation =
              preset?.contentItem.location ===
              radioBrowserLocation(stationuuid);
            return (
              <ListRow
                key={slot}
                title={preset ? preset.contentItem.itemName : "Empty"}
                subtitle={
                  holdsStation
                    ? `Preset ${slot} · Already this station`
                    : `Preset ${slot}`
                }
                artworkUri={preset?.contentItem.containerArt ?? null}
                fallbackIcon={preset ? icons.radio : icons.add}
                disabled={holdsStation || savingSlot !== null}
                trailing={
                  savingSlot === slot ? (
                    <ActivityIndicator
                      size="small"
                      color={color.textSecondary}
                    />
                  ) : undefined
                }
                onPress={() => {
                  chooseSlot(presetSpeaker, slot);
                }}
              />
            );
          })}
        </View>
      );
    }
    if (speakers.length === 0) {
      return (
        <EmptyState
          icon={icons.wifiOff}
          title="No speakers discovered"
          description="Make sure your SoundTouch speaker is online and on the same Wi-Fi."
        />
      );
    }
    return (
      <View>
        {speakers.map((speaker) => (
          <SpeakerCastItem
            key={speaker.deviceID}
            speaker={speaker}
            mode={mode}
            isCasting={castingToSpeakerId === speaker.deviceID}
            disabled={castingToSpeakerId !== null}
            onCast={(isConfigured) => {
              if (!isConfigured) {
                askToConfigure(speaker);
              } else if (mode === "play") {
                void castToSpeaker(speaker);
              } else {
                setCastError(null);
                setChosenSpeakerId(speaker.deviceID);
              }
            }}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} style={$sheet}>
      <View style={$header}>
        <Text variant="title" accessibilityRole="header">
          {mode === "play" ? "Play on…" : "Save to preset"}
        </Text>
        <Text variant="body" color="textSecondary" numberOfLines={2}>
          {presetSpeaker
            ? `Choose a preset on ${presetSpeaker.name} for "${name}".`
            : `Choose a speaker for "${name}".`}
        </Text>
      </View>

      {castError !== null && (
        <View style={$error} accessibilityLiveRegion="polite">
          <Icon name={icons.warning} color="danger" />
          <Text variant="body" style={$fill}>
            {castError}
          </Text>
        </View>
      )}

      {renderBody()}
    </SafeAreaView>
  );
}

/** The speaker has no Radio Browser source, e.g. after a factory reset. */
function isMissingSourceError(err: unknown) {
  return (
    (err instanceof Error && err.message === "UNKNOWN_SOURCE_ERROR") ||
    (err instanceof ApiError &&
      err.errors.some(
        (entry) =>
          entry.name === "UNKNOWN_SOURCE_ERROR" || entry.value === 1005,
      ))
  );
}

function sheetErrorMessage(err: unknown, speakerName: string, mode: Mode) {
  if (err instanceof StationNotStartedError) {
    return `${speakerName} couldn't start this station. It may be offline right now; try another one.`;
  }
  if (isMissingSourceError(err)) {
    return `${speakerName} is missing its internet radio source, which often happens after a factory reset. Configure it again from its settings.`;
  }
  return mode === "play"
    ? `Couldn't play this station on ${speakerName}. Check that the speaker is on and try again.`
    : `Couldn't save this station on ${speakerName}. Check that the speaker is on and try again.`;
}

function SpeakerCastItem({
  speaker,
  mode,
  isCasting,
  disabled,
  onCast,
}: {
  speaker: BoseSpeaker;
  mode: Mode;
  isCasting: boolean;
  disabled: boolean;
  onCast: (isConfigured: boolean) => void;
}) {
  const margeAPIStatus = useMargeAPIStatusQuery(speaker.host);
  const isPowerOff =
    speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";

  const isError = margeAPIStatus.isError;
  const isConfigured = margeAPIStatus.data === true;
  const isLoading = margeAPIStatus.isLoading;

  const getStatusText = () => {
    if (isCasting) {
      return "Starting station…";
    }
    if (isLoading) {
      return "Checking configuration…";
    }
    if (isError) {
      return "Connection failed";
    }
    if (!isConfigured) {
      return "Not configured for Marge API";
    }
    if (isPowerOff) {
      return "Standby";
    }
    return `Playing · Vol ${speaker.volume}%`;
  };

  const renderTrailing = () => {
    if (isCasting || isLoading) {
      return <ActivityIndicator size="small" color={color.textSecondary} />;
    }
    if (isError) {
      return <Icon name={icons.warning} size={16} color="danger" />;
    }
    if (isConfigured) {
      return (
        <Icon
          name={mode === "play" ? icons.play : icons.chevronRight}
          size={16}
          color="textPrimary"
        />
      );
    }
    return <Icon name={icons.lock} size={16} color="textTertiary" />;
  };

  return (
    <ListRow
      title={speaker.name}
      subtitle={getStatusText()}
      disabled={disabled || isLoading || isError}
      leading={
        <View style={$speakerIcon}>
          <Icon name={icons.speaker} size={20} />
        </View>
      }
      trailing={renderTrailing()}
      onPress={() => {
        onCast(isConfigured);
      }}
    />
  );
}

const $sheet: ViewStyle = {
  paddingBottom: space.md,
};

const $header: ViewStyle = {
  gap: space.xxs,
  paddingHorizontal: space.screen,
  paddingTop: space.xl,
  paddingBottom: space.xs,
};

const $error: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
  marginHorizontal: space.screen,
  marginVertical: space.xs,
  padding: space.md,
  borderRadius: radius.md,
  backgroundColor: color.dangerMuted,
};

const $fill: TextStyle = {
  flex: 1,
};

const $speakerIcon: ViewStyle = {
  width: artwork.row,
  height: artwork.row,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.xs,
  backgroundColor: color.surface2,
};
