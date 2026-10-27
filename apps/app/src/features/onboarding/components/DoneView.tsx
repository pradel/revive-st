import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { COLORS } from "@/ui/theme";

import type { SpeakerIdentity } from "../session/types";
import {
  $setupBody,
  $setupButtons,
  $setupCard,
  $setupCardTitle,
  SetupButton,
  SetupHeader,
} from "./SetupLayout";

/** How long to wait for the speaker list to pick up the new speaker. */
const HANDOFF_TIMEOUT_MS = 15_000;

/**
 * Rescans the home network and hands off to the speaker's configuration once
 * the speaker list contains it; offers the dashboard if it doesn't show up.
 */
export function DoneView({
  speaker,
  host,
}: {
  speaker: SpeakerIdentity;
  host: string;
}) {
  const router = useRouter();
  const { speakers, rescan } = useBose();
  const [timedOut, setTimedOut] = useState(false);
  const listed = speakers.some((entry) => entry.deviceID === speaker.deviceID);

  useEffect(() => {
    rescan();
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, HANDOFF_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [rescan]);

  useEffect(() => {
    if (listed) {
      router.replace(
        `/speakers/${encodeURIComponent(speaker.deviceID)}/configure`,
      );
    }
  }, [listed, router, speaker.deviceID]);

  return (
    <>
      <SetupHeader
        icon={{
          ios: "checkmark.circle.fill",
          android: "check_circle",
          web: "check_circle",
        }}
        tone="success"
        title="Speaker connected"
        description={`${speaker.name} is on your Wi-Fi at ${host}.`}
      />

      {!timedOut || listed ? (
        <View style={$waiting}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={$setupBody}>Opening the speaker…</Text>
        </View>
      ) : (
        <>
          <Card style={$setupCard}>
            <Text style={$setupCardTitle}>Not in your speaker list yet</Text>
            <Text style={$setupBody}>
              The speaker should appear on the dashboard within a minute. Open
              it there to finish its configuration.
            </Text>
          </Card>
          <View style={$setupButtons}>
            <SetupButton
              label="Go to dashboard"
              icon={{ ios: "house", android: "home", web: "home" }}
              onPress={() => {
                router.dismissTo("/");
              }}
            />
          </View>
        </>
      )}
    </>
  );
}

const $waiting: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  marginTop: 8,
};
