import { FieldGroup, RNHostView } from "@expo/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import {
  SpeakerSettingsHeader,
  type SpeakerStatus,
} from "@/features/speakers/components/SpeakerSettingsHeader";
import { useSpeakerCommands } from "@/features/speakers/hooks/useSpeakerCommands";
import { speakerDrawing } from "@/features/speakers/lib/drawing";
import { speakerStateLabel } from "@/features/speakers/lib/playback";
import {
  isPartnerUnreachable,
  pairLedBy,
  partnersOf,
  roleLabel,
} from "@/features/speakers/lib/stereo-pair";
import {
  speakerRegistry,
  useSpeakers,
} from "@/features/speakers/registry/store";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { Form } from "@/ui/form/Form";
import { formIcons } from "@/ui/form/icons";
import {
  FormButtonRow,
  FormFooterText,
  FormLinkRow,
  FormSliderRow,
} from "@/ui/form/rows";
import { FormSection } from "@/ui/form/Section";
import { color } from "@/ui/tokens";

/** Where the balance leans: "Left 3", "Center" or "Right 2". */
const balanceLabel = (value: number) => {
  if (value < 0) {
    return `Left ${-value}`;
  }
  if (value > 0) {
    return `Right ${value}`;
  }
  return "Center";
};

/**
 * A stereo pair's settings, opened from its card (`id` is its master): its
 * name, which speaker plays each side (each with its own settings), its
 * balance, and unpairing.
 */
export default function PairSettings() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { all } = useSpeakers();
  const { unpairMutation, setBalanceMutation } = useSpeakerCommands();
  // Bumped when a balance isn't taken, to put the slider back.
  const [balanceFailures, setBalanceFailures] = useState(0);

  const master = all.find((speaker) => speaker.deviceID === id);
  const pair = master && pairLedBy(master);

  if (!master || !pair) {
    return (
      <Screen>
        <Stack.Title>Stereo pair</Stack.Title>
        <EmptyState
          icon={icons.speaker}
          title="Stereo pair not found"
          description="The speakers may have been unpaired."
          actions={
            <Button
              label="Go back"
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

  const sides = [...pair.roles]
    .sort((a, b) => a.role.localeCompare(b.role))
    .map((role) => ({
      role: role.role,
      deviceID: role.deviceID,
      speaker: all.find((speaker) => speaker.deviceID === role.deviceID),
    }));
  const partnerNames = partnersOf(pair)
    .map(
      (deviceID) =>
        all.find((speaker) => speaker.deviceID === deviceID)?.speakerName,
    )
    .filter((name) => name !== undefined);
  const partnerName = partnerNames[0] ?? "The other speaker";
  const partnerUnreachable = isPartnerUnreachable(master);
  const reachable = sides.some((side) => side.speaker?.status === "online");

  const status = ((): SpeakerStatus => {
    if (master.status !== "online") {
      return { label: speakerStateLabel(master), tone: "neutral" };
    }
    if (partnerUnreachable) {
      return { label: "Partner unreachable", tone: "danger" };
    }
    if (master.pairStatus === "GROUP_CONNECTING") {
      return { label: "Connecting to its partner…", tone: "neutral" };
    }
    return { label: "Online · Stereo pair", tone: "ok" };
  })();

  const refresh = async () => {
    await Promise.allSettled(
      sides.map(async (side) => speakerRegistry.refresh(side.deviceID)),
    );
  };

  const unpair = () => {
    haptics.tap();
    unpairMutation.mutate(
      { pair },
      {
        onSuccess: ({ peerUnreachable, via }) => {
          haptics.success();
          if (peerUnreachable) {
            // The speaker the request didn't go through: the partner, or the
            // master when it went through the partner.
            const missing = sides.find((side) => side.deviceID !== via);
            Alert.alert(
              "Unpaired",
              `${missing?.speaker?.speakerName ?? "The other speaker"} didn't answer. It leaves the pair once it's back online.`,
            );
          }
          router.back();
        },
        onError: (error) => {
          logger.warn("[Pair] Failed to unpair:", error);
          haptics.error();
          Alert.alert(
            "Couldn't unpair",
            "Make sure the speakers are on and on the same Wi-Fi network as your phone, then try again.",
          );
        },
      },
    );
  };

  const confirmUnpair = () => {
    Alert.alert(
      `Unpair ${pair.name}?`,
      "Both speakers then play on their own again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unpair", style: "destructive", onPress: unpair },
      ],
    );
  };

  const unpairing = unpairMutation.isPending;

  // Both speakers report it; the pair's master is asked.
  const balance =
    master.status === "online" && master.balance?.balanceAvailable
      ? master.balance
      : undefined;

  const setBalance = (value: number) => {
    setBalanceMutation.mutate(
      { deviceID: master.deviceID, value },
      {
        onError: (error) => {
          logger.warn("[Pair] Failed to set the balance:", error);
          haptics.error();
          setBalanceFailures((failures) => failures + 1);
          Alert.alert(
            "Couldn't set the balance",
            "Make sure the speakers are on and on the same Wi-Fi network as your phone, then try again.",
          );
        },
      },
    );
  };

  return (
    <Screen>
      <Stack.Title>{pair.name}</Stack.Title>
      <Form onRefresh={refresh}>
        <FormSection>
          <RNHostView matchContents={{ vertical: true }}>
            <SpeakerSettingsHeader
              name={pair.name}
              model="Stereo pair"
              host={master.host}
              drawing={speakerDrawing(master.type)}
              status={status}
            />
          </RNHostView>
        </FormSection>

        <FormSection title="General">
          <FormLinkRow
            label="Name"
            value={pair.name}
            disabled={master.status !== "online" || master.pairRead !== true}
            onPress={() => {
              router.push("./rename-pair");
            }}
          />
          {master.status === "online" && master.pairRead !== true ? (
            <>
              <FormButtonRow
                label="Check again"
                onPress={() => {
                  void speakerRegistry.refresh(master.deviceID);
                }}
              />
              <FieldGroup.SectionFooter>
                <FormFooterText>
                  {`${master.speakerName} hasn't said which pair it's in yet, so the pair can't be renamed. Check again to ask it.`}
                </FormFooterText>
              </FieldGroup.SectionFooter>
            </>
          ) : null}
        </FormSection>

        <FormSection title="Speakers">
          {sides.map((side) => (
            <FormLinkRow
              key={side.deviceID}
              icon={formIcons.speaker}
              label={roleLabel(side.role)}
              description={
                side.speaker?.status === "online"
                  ? undefined
                  : side.speaker
                    ? speakerStateLabel(side.speaker)
                    : "Not found yet"
              }
              value={side.speaker?.speakerName ?? "Unknown speaker"}
              disabled={side.speaker?.status !== "online"}
              onPress={() => {
                router.push(
                  `/speakers/${encodeURIComponent(side.deviceID)}/settings`,
                );
              }}
            />
          ))}
          <FieldGroup.SectionFooter>
            {partnerUnreachable ? (
              <FormFooterText color={color.danger}>
                {`${partnerName} doesn't answer, so ${master.speakerName} goes to standby. Turn ${partnerName} on, or unpair to play on ${master.speakerName} alone.`}
              </FormFooterText>
            ) : (
              <FormFooterText>
                {`Volume, power and source set on either speaker apply to both. ${master.speakerName} leads the pair: if ${partnerName} drops out, it goes to standby about 30 seconds later.`}
              </FormFooterText>
            )}
          </FieldGroup.SectionFooter>
        </FormSection>

        {balance ? (
          <FormSection title="Sound">
            <FormSliderRow
              key={balanceFailures}
              label="Balance"
              value={balance.targetBalance}
              min={balance.balanceMin}
              max={balance.balanceMax}
              step={1}
              saving={setBalanceMutation.isPending}
              formatValue={balanceLabel}
              rangeLabels={["Left", "Right"]}
              onCommit={(value) => {
                setBalance(Math.round(value));
              }}
            />
            <FormButtonRow
              label="Center"
              disabled={
                setBalanceMutation.isPending ||
                balance.targetBalance === balance.balanceDefault
              }
              onPress={() => {
                setBalance(balance.balanceDefault);
              }}
            />
          </FormSection>
        ) : null}

        <FormSection>
          <FormButtonRow
            label={unpairing ? "Unpairing…" : "Unpair"}
            disabled={unpairing || !reachable}
            onPress={confirmUnpair}
          />
          <FieldGroup.SectionFooter>
            <FormFooterText>
              {reachable
                ? "Both speakers play on their own again."
                : "Neither speaker is reached. Turn them on to unpair them."}
            </FormFooterText>
          </FieldGroup.SectionFooter>
        </FormSection>
      </Form>
    </Screen>
  );
}
