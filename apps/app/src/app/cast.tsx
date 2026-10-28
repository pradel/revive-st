import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBose } from "@/features/speakers/contexts/BoseContext";
import {
  useMargeAPIStatusQuery,
  type BoseSpeaker,
} from "@/features/speakers/hooks/useSpeakerManager";
import { logger } from "@/lib/logger";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Text } from "@/ui/ds/Text";
import { artwork, color, radius, space } from "@/ui/tokens";

/** "Play on…" sheet: streams a radio station to the chosen speaker. */
export default function CastSheet() {
  const router = useRouter();
  const station = useLocalSearchParams<{ name: string; url: string }>();
  const { speakers, playStreamMutation } = useBose();
  const [castingToSpeakerId, setCastingToSpeakerId] = useState<string | null>(
    null,
  );
  const [castError, setCastError] = useState<string | null>(null);

  const castToSpeaker = async (speaker: BoseSpeaker) => {
    setCastError(null);
    setCastingToSpeakerId(speaker.deviceID);
    logger.info(`[cast] Casting ${station.url} to ${speaker.host}`);
    try {
      await playStreamMutation.mutateAsync({
        deviceID: speaker.deviceID,
        uri: station.url,
        name: station.name,
      });
      // Success shows up in the mini player; no need to interrupt.
      router.back();
    } catch (err) {
      logger.error(err);
      setCastError(
        err instanceof Error && err.message === "UNKNOWN_SOURCE_ERROR"
          ? `${speaker.name} is missing its internet radio source, which often happens after a factory reset. Configure it again from its settings.`
          : `Couldn't play this station on ${speaker.name}. Check that the speaker is on and try again.`,
      );
    } finally {
      setCastingToSpeakerId(null);
    }
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

  return (
    <SafeAreaView edges={["bottom"]} style={$sheet}>
      <View style={$header}>
        <Text variant="title" accessibilityRole="header">
          Play on…
        </Text>
        <Text variant="body" color="textSecondary" numberOfLines={2}>
          {`Choose a speaker for "${station.name}".`}
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

      {speakers.length === 0 ? (
        <EmptyState
          icon={icons.wifiOff}
          title="No speakers discovered"
          description="Make sure your SoundTouch speaker is online and on the same Wi-Fi."
        />
      ) : (
        <View>
          {speakers.map((speaker) => (
            <SpeakerCastItem
              key={speaker.deviceID}
              speaker={speaker}
              isCasting={castingToSpeakerId === speaker.deviceID}
              disabled={castingToSpeakerId !== null}
              onCast={(isConfigured) => {
                if (isConfigured) {
                  void castToSpeaker(speaker);
                } else {
                  askToConfigure(speaker);
                }
              }}
            />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

function SpeakerCastItem({
  speaker,
  isCasting,
  disabled,
  onCast,
}: {
  speaker: BoseSpeaker;
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
      return <Icon name={icons.play} size={16} color="textPrimary" />;
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
