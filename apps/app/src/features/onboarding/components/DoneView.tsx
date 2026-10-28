import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import { Button } from "@/ui/ds/Button";
import { Text } from "@/ui/ds/Text";
import { color, space } from "@/ui/tokens";

import type { SpeakerIdentity } from "../session/types";
import {
  $setupButtons,
  $setupCard,
  $setupCardTitle,
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
  renameFailed = false,
}: {
  speaker: SpeakerIdentity;
  /** The new name couldn't be saved; the speaker kept its old one. */
  renameFailed?: boolean;
}) {
  const router = useRouter();
  const { speakers, rescan } = useBose();
  const [timedOut, setTimedOut] = useState(false);
  const listed = speakers.some((entry) => entry.deviceID === speaker.deviceID);
  // A failed rename is shown until the user moves on, instead of flashing past.
  const [acknowledged, setAcknowledged] = useState(!renameFailed);

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
    if (listed && acknowledged) {
      router.replace(
        `/speakers/${encodeURIComponent(speaker.deviceID)}/configure`,
      );
    }
  }, [listed, acknowledged, router, speaker.deviceID]);

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
        description={`${speaker.name} is on your Wi-Fi.`}
      />

      {renameFailed && (
        <Card style={$setupCard}>
          <Text variant="headline" style={$setupCardTitle}>
            Name not changed
          </Text>
          <Text variant="body" color="textSecondary">
            The speaker couldn't be renamed, so it kept its current name. You
            can change it later in the speaker's settings.
          </Text>
        </Card>
      )}

      {!acknowledged ? (
        <View style={$setupButtons}>
          <Button
            label="Continue"
            icon={{
              ios: "arrow.right",
              android: "arrow_forward",
              web: "arrow_forward",
            }}
            onPress={() => {
              setAcknowledged(true);
            }}
          />
        </View>
      ) : !timedOut || listed ? (
        <View style={$waiting}>
          <ActivityIndicator size="small" color={color.accent} />
          <Text variant="body" color="textSecondary">
            Opening the speaker…
          </Text>
        </View>
      ) : (
        <>
          <Card style={$setupCard}>
            <Text variant="headline" style={$setupCardTitle}>
              Not in your speaker list yet
            </Text>
            <Text variant="body" color="textSecondary">
              The speaker should appear on the dashboard within a minute. Open
              it there to finish its configuration.
            </Text>
          </Card>
          <View style={$setupButtons}>
            <Button
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
  gap: space.sm,
  marginTop: space.xs,
};
