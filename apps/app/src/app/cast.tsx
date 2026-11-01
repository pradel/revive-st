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
import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import {
  StationNotStartedError,
  stationFit,
  type CastStation,
  type StationPlay,
} from "@/features/speakers/lib/radio";
import { useSpeakers } from "@/features/speakers/registry/store";
import type { BoseSpeaker } from "@/features/speakers/registry/types";
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
 * "Play on…" and "Save to preset" sheet for a station: picks a speaker, then
 * plays the station on it or stores it on one of its six presets. A Radio
 * Browser station comes as `stationuuid`, with its stream as `streamUrl` for
 * speakers whose server has no Radio Browser; a stream added by URL as
 * `streamUrl` alone.
 */
export default function CastSheet() {
  const router = useRouter();
  const {
    mode = "play",
    stationuuid = "",
    streamUrl,
    name,
    favicon = "",
  } = useLocalSearchParams<{
    stationuuid?: string;
    streamUrl?: string;
    name: string;
    favicon?: string;
    mode?: Mode;
  }>();
  const station: CastStation = stationuuid
    ? {
        kind: "radioBrowser",
        stationuuid,
        streamUrl: streamUrl ?? "",
        name,
        favicon,
      }
    : { kind: "custom", streamUrl: streamUrl ?? "", name, favicon };
  const { online: speakers } = useSpeakers();
  const { playStationMutation, storeStationPresetMutation } =
    useSpeakerCommands();
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

  // With a single speaker, saving goes straight to its presets, once it can
  // play the station: until then the speaker list shows its status and
  // offers to set it up, as when choosing among several.
  const onlySpeaker =
    mode === "preset" && speakers.length === 1 ? speakers[0] : undefined;
  const presetSpeakerId =
    chosenSpeakerId ??
    (onlySpeaker && stationFit(onlySpeaker.radio, station).kind === "plays"
      ? onlySpeaker.deviceID
      : null);
  const presetSpeaker =
    mode === "preset"
      ? speakers.find((speaker) => speaker.deviceID === presetSpeakerId)
      : undefined;
  const presetFit = presetSpeaker && stationFit(presetSpeaker.radio, station);
  const presetPlay = presetFit?.kind === "plays" ? presetFit : undefined;

  const castToSpeaker = async (speaker: BoseSpeaker, play: StationPlay) => {
    setCastError(null);
    setCastingToSpeakerId(speaker.deviceID);
    logger.info(`[cast] Casting ${name} to ${speaker.host}`);
    try {
      await playStationMutation.mutateAsync({
        deviceID: speaker.deviceID,
        contentItem: play.contentItem,
      });
      // Success shows up in the mini player; no need to interrupt.
      haptics.success();
      if (station.kind === "radioBrowser") {
        countStationClick(station.stationuuid).catch((err: unknown) => {
          logger.warn("[cast] Couldn't count the station's play", err);
        });
      }
      if (mountedRef.current) {
        router.back();
      }
    } catch (err) {
      showFailure(err, speaker, play);
    } finally {
      setCastingToSpeakerId(null);
    }
  };

  const storeInSlot = async (
    speaker: BoseSpeaker,
    play: StationPlay,
    slot: PresetSlot,
  ) => {
    setCastError(null);
    setSavingSlot(slot);
    logger.info(`[cast] Saving ${name} to preset ${slot} on ${speaker.host}`);
    try {
      await storeStationPresetMutation.mutateAsync({
        deviceID: speaker.deviceID,
        presetId: slot,
        contentItem: play.contentItem,
      });
      haptics.success();
      if (mountedRef.current) {
        router.back();
      }
    } catch (err) {
      showFailure(err, speaker, play);
    } finally {
      setSavingSlot(null);
    }
  };

  const chooseSlot = (
    speaker: BoseSpeaker,
    play: StationPlay,
    slot: PresetSlot,
  ) => {
    const current = speaker.presets?.find((preset) => preset.id === slot);
    // A speaker keeps a station on one preset only: storing it on another
    // moves it there and empties the one it was on.
    const savedOn = speaker.presets?.find(
      (preset) => preset.contentItem.location === play.contentItem.location,
    )?.id;
    const consequences = [
      current && `"${current.contentItem.itemName}" will be replaced.`,
      savedOn !== undefined &&
        `"${name}" moves from preset ${savedOn}, which becomes empty.`,
    ].filter(Boolean);
    if (consequences.length === 0) {
      void storeInSlot(speaker, play, slot);
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
            void storeInSlot(speaker, play, slot);
          },
        },
      ],
    );
  };

  const askToConfigure = (
    speaker: BoseSpeaker,
    title = "Set up internet radio?",
    message = `${speaker.name} needs to be set up for Revive ST before it can play internet radio.`,
  ) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Set up",
        onPress: () => {
          router.back();
          router.push(
            `/speakers/${encodeURIComponent(speaker.deviceID)}/configure`,
          );
        },
      },
    ]);
  };

  const showFailure = (
    err: unknown,
    speaker: BoseSpeaker,
    play: StationPlay,
  ) => {
    logger.error(err);
    haptics.error();
    setCastError(
      sheetErrorMessage(err, speaker.name, mode, station.kind, play),
    );
    // Speakers set up before custom stations existed lack the source until
    // they fetch it again, which setting them up again for our server does.
    if (
      play.contentItem.source === "LOCAL_INTERNET_RADIO" &&
      play.through === null &&
      isMissingSourceError(err)
    ) {
      askCustomStationsSetup(speaker);
    }
  };

  const askCustomStationsSetup = (speaker: BoseSpeaker) => {
    askToConfigure(
      speaker,
      `Add custom stations to ${speaker.name}?`,
      `${speaker.name} gets custom stations when it's set up again. Setting it up restarts it.`,
    );
  };

  const renderBody = () => {
    if (presetSpeaker && presetPlay) {
      return (
        <View>
          {PRESET_SLOTS.map((slot) => {
            const preset = presetSpeaker.presets?.find(
              (entry) => entry.id === slot,
            );
            const holdsStation =
              preset?.contentItem.location === presetPlay.contentItem.location;
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
                  chooseSlot(presetSpeaker, presetPlay, slot);
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
            station={station}
            mode={mode}
            isCasting={castingToSpeakerId === speaker.deviceID}
            disabled={castingToSpeakerId !== null}
            onSetUp={() => {
              askToConfigure(speaker);
            }}
            onSetUpCustomStations={() => {
              askCustomStationsSetup(speaker);
            }}
            onCast={(play) => {
              if (mode === "play") {
                void castToSpeaker(speaker, play);
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

/** The speaker lacks the station's source, e.g. after a factory reset. */
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

function sheetErrorMessage(
  err: unknown,
  speakerName: string,
  mode: Mode,
  kind: CastStation["kind"],
  play: StationPlay,
) {
  if (err instanceof StationNotStartedError) {
    return kind === "custom"
      ? `${speakerName} couldn't start this stream. Check that it's online and isn't an HLS stream.`
      : `${speakerName} couldn't start this station. It may be offline right now; try another one.`;
  }
  if (isMissingSourceError(err)) {
    if (play.through !== null) {
      return `${speakerName} can't play this station through ${play.through}, which doesn't offer its source.`;
    }
    return play.contentItem.source === "LOCAL_INTERNET_RADIO"
      ? `${speakerName} doesn't have custom stations yet. Set it up again from its settings to add them.`
      : `${speakerName} is missing its internet radio source, which often happens after a factory reset. Set it up again from its settings.`;
  }
  return mode === "play"
    ? `Couldn't play this station on ${speakerName}. Check that the speaker is on and try again.`
    : `Couldn't save this station on ${speakerName}. Check that the speaker is on and try again.`;
}

/** Why a speaker whose radio is ready can't take the station. */
const unplayableText = (
  station: CastStation,
  server: string,
  setupAdds: boolean,
) => {
  if (setupAdds) {
    return "Needs setup for custom stations";
  }
  return station.kind === "custom"
    ? `No custom stations on ${server}`
    : `Can't play this station through ${server}`;
};

function SpeakerCastItem({
  speaker,
  station,
  mode,
  isCasting,
  disabled,
  onSetUp,
  onSetUpCustomStations,
  onCast,
}: {
  speaker: BoseSpeaker;
  station: CastStation;
  mode: Mode;
  isCasting: boolean;
  disabled: boolean;
  /** The speaker needs setting up for internet radio. */
  onSetUp: () => void;
  /** The speaker uses our server but was set up before custom stations. */
  onSetUpCustomStations: () => void;
  onCast: (play: StationPlay) => void;
}) {
  const { radio } = speaker;
  const isPowerOff =
    speaker.source === "STANDBY" || speaker.playStatus === "STANDBY";

  const isLoading = radio.kind === "checking";
  const isError = radio.kind === "unreachable";
  const fit = stationFit(radio, station);
  const isUnplayable = fit.kind === "noSource";
  const canAddSource = fit.kind === "noSource" && fit.setupAdds;

  const getStatusText = () => {
    if (isCasting) {
      return "Starting station…";
    }
    if (isLoading) {
      return "Checking setup…";
    }
    if (isError) {
      return "Connection failed";
    }
    if (fit.kind === "notReady") {
      return "Needs setup for internet radio";
    }
    if (fit.kind === "noSource") {
      return unplayableText(station, fit.server, fit.setupAdds);
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
    if (fit.kind === "plays") {
      return (
        <Icon
          name={mode === "play" ? icons.play : icons.chevronRight}
          size={16}
          color="textPrimary"
        />
      );
    }
    if (isUnplayable && !canAddSource) {
      return undefined;
    }
    return <Icon name={icons.lock} size={16} color="textTertiary" />;
  };

  return (
    <ListRow
      title={speaker.name}
      subtitle={getStatusText()}
      disabled={
        disabled || isLoading || isError || (isUnplayable && !canAddSource)
      }
      leading={
        <View style={$speakerIcon}>
          <Icon name={icons.speaker} size={20} />
        </View>
      }
      trailing={renderTrailing()}
      onPress={() => {
        if (fit.kind === "plays") {
          onCast(fit);
        } else if (isUnplayable) {
          onSetUpCustomStations();
        } else {
          onSetUp();
        }
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
