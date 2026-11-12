import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View, type TextStyle, type ViewStyle } from "react-native";

import { KeepAwake } from "@/components/KeepAwake";
import { Card } from "@/components/ui/Card";
import {
  $setupButtons,
  $setupCard,
  $setupCardTitle,
  $setupNote,
  SetupHeader,
} from "@/features/onboarding/components/SetupLayout";
import { useServerUrl } from "@/features/server/server";
import { serverHost } from "@/features/server/server-url";
import {
  defaultPairName,
  isSoundTouch10,
  PAIR_NAME_MAX_LENGTH,
  PAIR_PROBLEM_LABELS,
  pairProblem,
  partnerProblem,
  validatePairName,
} from "@/features/speakers/lib/stereo-pair";
import { useSpeakers } from "@/features/speakers/registry/store";
import type { BoseSpeaker } from "@/features/speakers/registry/types";
import {
  PairDoneView,
  PairFailedView,
  PairWorkingView,
} from "@/features/stereo-pair/components/PairViews";
import type { PairMember, PairView } from "@/features/stereo-pair/session";
import {
  endPairing,
  startPairing,
  usePairRun,
} from "@/features/stereo-pair/store";
import { useZones } from "@/features/stereo-pair/useZones";
import { haptics } from "@/lib/haptics";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { ListRow } from "@/ui/ds/ListRow";
import { Screen } from "@/ui/ds/Screen";
import { Text } from "@/ui/ds/Text";
import { TextField } from "@/ui/ds/TextField";
import { space } from "@/ui/tokens";

const SWAP_ICON = {
  ios: "arrow.left.arrow.right",
  android: "swap_horiz",
  web: "swap_horiz",
} as const;

/** Haptics, once per finished run seen on screen. */
function useOutcomeEffects(view: PairView | undefined) {
  const previous = useRef(view);
  useEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (view === undefined || before === view || before?.kind !== "working") {
      return;
    }
    if (view.kind === "done") {
      haptics.success();
    } else if (view.kind === "failed") {
      haptics.error();
    }
  }, [view]);
}

const member = (speaker: BoseSpeaker): PairMember => ({
  deviceID: speaker.deviceID,
  name: speaker.speakerName,
  host: speaker.host,
  port: speaker.port,
});

/**
 * Pairs this SoundTouch 10 with another one: pick the partner (the ones
 * that can't pair are greyed with why), which side each plays and the pair's
 * name, then follow the pairing, which carries on if the screen is left.
 */
export default function CreatePair() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { all } = useSpeakers();
  const host = serverHost(useServerUrl());
  const { run, view } = usePairRun(id);
  useOutcomeEffects(view);

  const speaker = all.find(
    (item) => item.deviceID === id && item.status === "online",
  );
  const candidates = all.filter(
    (item) => item.deviceID !== id && isSoundTouch10(item.type),
  );
  const zones = useZones(speaker ? [speaker, ...candidates] : candidates);

  const [partnerID, setPartnerID] = useState<string>();
  const [speakerIsLeft, setSpeakerIsLeft] = useState(true);
  /** `undefined` until edited: the name follows the speakers picked. */
  const [draftName, setDraftName] = useState<string>();
  const [attempted, setAttempted] = useState(false);

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const renderRun = () => {
    if (!run || !view) {
      return null;
    }
    switch (view.kind) {
      case "working": {
        return <PairWorkingView view={view} target={run.target} />;
      }
      case "failed": {
        return (
          <PairFailedView
            view={view}
            target={run.target}
            serverHost={host}
            onRetry={() => {
              run.session.retry();
            }}
            onClose={() => {
              endPairing(id);
              close();
            }}
            onShowLogs={() => {
              router.push("/logs");
            }}
          />
        );
      }
      default: {
        return (
          <PairDoneView
            view={view}
            target={run.target}
            onDone={() => {
              endPairing(id);
              close();
            }}
          />
        );
      }
    }
  };

  const renderSetup = () => {
    if (!speaker) {
      return (
        <EmptyState
          icon={icons.speaker}
          title="Speaker not found"
          actions={
            <Button label="Go back" variant="secondary" onPress={close} />
          }
        />
      );
    }
    const ownProblem = pairProblem(speaker, zones.get(speaker.deviceID));
    if (ownProblem !== undefined && ownProblem !== "checking") {
      return (
        <EmptyState
          icon={icons.speaker}
          title={`${speaker.speakerName} can't be paired`}
          description={`${PAIR_PROBLEM_LABELS[ownProblem]}. Both speakers of a stereo pair must be SoundTouch 10s set up for Revive ST on the same account, and not playing in a multiroom zone.`}
          actions={
            <Button label="Go back" variant="secondary" onPress={close} />
          }
        />
      );
    }

    const partner = candidates.find(
      (candidate) =>
        candidate.deviceID === partnerID &&
        partnerProblem(speaker, candidate, zones.get(candidate.deviceID)) ===
          undefined,
    );
    const [left, right] = partner
      ? speakerIsLeft
        ? [speaker, partner]
        : [partner, speaker]
      : [undefined, undefined];
    const name =
      draftName ??
      (left && right
        ? defaultPairName(left.speakerName, right.speakerName)
        : "");
    const nameProblem = validatePairName(name);
    const ready = ownProblem === undefined && left && right;

    const pair = () => {
      setAttempted(true);
      if (!ready || nameProblem !== undefined) {
        return;
      }
      haptics.tap();
      startPairing(id, {
        name: name.trim(),
        left: member(left),
        right: member(right),
      });
    };

    return (
      <>
        <SetupHeader
          overline={speaker.speakerName}
          icon={icons.speaker}
          title="Make a stereo pair"
          description="Two SoundTouch 10s play as one speaker: one plays the left channel, the other the right. Volume, power and source then apply to both."
        />

        <Card style={$setupCard}>
          <Text variant="headline" style={$setupCardTitle}>
            Pair with
          </Text>
          {candidates.length === 0 ? (
            <Text variant="body" color="textSecondary">
              No other SoundTouch 10 found. Turn on the one to pair with, on the
              same Wi-Fi network as your phone.
            </Text>
          ) : (
            candidates.map((candidate) => {
              const problem = partnerProblem(
                speaker,
                candidate,
                zones.get(candidate.deviceID),
              );
              return (
                <ListRow
                  key={candidate.deviceID}
                  title={candidate.speakerName}
                  subtitle={
                    problem === undefined
                      ? candidate.host
                      : PAIR_PROBLEM_LABELS[problem]
                  }
                  leading={<Icon name={icons.speaker} />}
                  disabled={problem !== undefined}
                  selected={candidate.deviceID === partner?.deviceID}
                  onPress={() => {
                    haptics.tap();
                    setPartnerID(candidate.deviceID);
                  }}
                />
              );
            })
          )}
        </Card>

        {left && right ? (
          <Card style={$setupCard}>
            <Text variant="headline" style={$setupCardTitle}>
              Sides
            </Text>
            <View style={$sides}>
              <View style={$side}>
                <Text variant="caption" color="textSecondary">
                  Left
                </Text>
                <Text variant="body" numberOfLines={1}>
                  {left.speakerName}
                </Text>
              </View>
              <View style={$side}>
                <Text variant="caption" color="textSecondary">
                  Right
                </Text>
                <Text variant="body" numberOfLines={1}>
                  {right.speakerName}
                </Text>
              </View>
            </View>
            <Button
              label="Swap left and right"
              icon={SWAP_ICON}
              variant="secondary"
              onPress={() => {
                haptics.tap();
                setSpeakerIsLeft((isLeft) => !isLeft);
              }}
            />
            <Text variant="caption" color="textTertiary" style={$sideNote}>
              The left speaker leads the pair: if the right one drops out, the
              left one goes to standby about 30 seconds later.
            </Text>
          </Card>
        ) : null}

        {left && right ? (
          <View style={$field}>
            <TextField
              icon={icons.speaker}
              placeholder="Pair name"
              value={name}
              onChangeText={setDraftName}
              onSubmitEditing={pair}
              maxLength={PAIR_NAME_MAX_LENGTH}
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel="Pair name"
            />
            {attempted && nameProblem !== undefined ? (
              <Text variant="subhead" color="danger" style={$problem}>
                {nameProblem}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={$setupButtons}>
          <Button
            label="Pair"
            icon={icons.speaker}
            loading={ownProblem === "checking"}
            disabled={!ready || (attempted && nameProblem !== undefined)}
            onPress={pair}
          />
          <Button label="Cancel" variant="secondary" onPress={close} />
          <Text variant="caption" color="textTertiary" style={$setupNote}>
            You can unpair them at any time in the pair's settings.
          </Text>
        </View>
      </>
    );
  };

  return (
    <Screen>
      <Stack.Title>Stereo pair</Stack.Title>
      {view?.kind === "working" && <KeepAwake />}
      <ScrollView
        contentContainerStyle={$content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {run ? renderRun() : renderSetup()}
      </ScrollView>
    </Screen>
  );
}

const $content: ViewStyle = {
  paddingHorizontal: space.screen,
  paddingBottom: space.xxxl,
  gap: space.md,
};

const $sides: ViewStyle = {
  flexDirection: "row",
  gap: space.md,
  marginBottom: space.md,
};

const $side: ViewStyle = {
  flex: 1,
  gap: space.xxs,
};

const $sideNote: TextStyle = {
  marginTop: space.sm,
};

const $field: ViewStyle = {
  width: "100%",
  gap: space.xs,
};

const $problem: TextStyle = {
  textAlign: "center",
};
