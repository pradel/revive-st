import { View, type TextStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import {
  $setupButtons,
  $setupCard,
  $setupNote,
  SetupHeader,
} from "@/features/onboarding/components/SetupLayout";
import {
  MIN_SERVER_VERSION,
  oldRelease,
} from "@/features/server/server-version";
import { formatElapsed, useElapsed } from "@/lib/useElapsed";
import { Button } from "@/ui/ds/Button";
import { type IconName, icons } from "@/ui/ds/Icon";
import { StepList, type StepListItem } from "@/ui/ds/StepList";
import { Text } from "@/ui/ds/Text";

import {
  PAIR_BUDGET_MS,
  PAIR_STEP_IDS,
  type PairError,
  type PairStepId,
  type PairTarget,
  type PairView,
} from "../session";

const STEP_TITLES: Record<PairStepId, string> = {
  check: "Check Revive ST",
  pair: "Pair the speakers",
  confirm: "Wait for both speakers",
};

const SUCCESS_ICON: IconName = {
  ios: "checkmark.circle.fill",
  android: "check_circle",
  web: "check_circle",
};

const ERROR_ICON: IconName = {
  ios: "exclamationmark.triangle",
  android: "warning",
  web: "warning",
};

const BUDGET_SECONDS = PAIR_BUDGET_MS / 1000;

function steps(
  current: PairStepId,
  status: "active" | "error" | "done",
  trailing?: { text: string; label: string },
  errorTitle?: string,
): StepListItem[] {
  const currentIndex = PAIR_STEP_IDS.indexOf(current);
  return PAIR_STEP_IDS.map((step, index) => {
    const isCurrent = index === currentIndex;
    const stepStatus =
      status === "done" || index < currentIndex
        ? "done"
        : isCurrent
          ? status
          : "pending";
    return {
      id: step,
      title: STEP_TITLES[step],
      status: stepStatus,
      ...(isCurrent && stepStatus === "error" && errorTitle !== undefined
        ? { description: errorTitle }
        : {}),
      ...(isCurrent && stepStatus === "active" && trailing
        ? {
            trailing: (
              <Text variant="subhead" color="accent" style={$elapsed}>
                {trailing.text}
              </Text>
            ),
            trailingLabel: trailing.label,
          }
        : {}),
    };
  });
}

/** What went wrong, in the user's words. */
export function describePairError(
  error: PairError,
  target: PairTarget,
  serverHost: string,
): { title: string; message: string } {
  const { left, right } = target;
  switch (error.kind) {
    case "serverUnreachable": {
      return {
        title: "Couldn't reach Revive ST",
        message: `${serverHost} didn't answer. It stores the pair, so the speakers keep it when they restart. Check your connection, then try again.`,
      };
    }
    case "serverUnsupported": {
      return error.check.kind === "notRevive"
        ? {
            title: "Not a Revive ST server",
            message: `${serverHost} doesn't answer like a Revive ST server. Check the server in Settings.`,
          }
        : {
            title: "Update your Revive ST server",
            message: `${serverHost} runs ${oldRelease(error.check.version)}, and stereo pairs need ${MIN_SERVER_VERSION} or newer. Update the server, then try again.`,
          };
    }
    case "serverRejected": {
      return {
        title: "Revive ST couldn't store the pair",
        message: `${left.name} asked ${serverHost} to store the pair, and it couldn't. Make sure the server is up to date and running, then try again.`,
      };
    }
    case "alreadyPaired": {
      return {
        title: "Already in a pair",
        message: `${left.name} or ${right.name} is still in another stereo pair. Unpair it in its settings, then try again.`,
      };
    }
    case "speakerFailed": {
      return {
        title: "Couldn't pair the speakers",
        message: `${left.name} didn't take the pair. Make sure both speakers are on and on the same Wi-Fi network as your phone, then try again.`,
      };
    }
    case "notConfirmed": {
      return {
        title: "The pair didn't form",
        message: error.undone
          ? `${left.name} and ${right.name} didn't both join the pair within ${BUDGET_SECONDS} seconds, so it was undone. Make sure both speakers are on, then try again.`
          : `${left.name} and ${right.name} didn't both join the pair within ${BUDGET_SECONDS} seconds. Make sure both speakers are on, then try again.`,
      };
    }
    default: {
      const unhandled: never = error;
      throw new Error(`Unhandled error ${JSON.stringify(unhandled)}`);
    }
  }
}

export function PairWorkingView({
  view,
  target,
}: {
  view: Extract<PairView, { kind: "working" }>;
  target: PairTarget;
}) {
  const elapsed = useElapsed(view.startedAt);
  const seconds = Math.floor(elapsed / 1000);
  return (
    <>
      <SetupHeader
        overline={target.name}
        icon={icons.speaker}
        title="Pairing…"
        description={`${target.left.name} plays the left channel and ${target.right.name} the right. This takes up to ${BUDGET_SECONDS} seconds.`}
      />
      <Card style={$setupCard}>
        <StepList
          steps={steps(view.step, "active", {
            text: formatElapsed(elapsed),
            label: `${seconds} seconds`,
          })}
        />
      </Card>
      <Text variant="caption" color="textTertiary" style={$setupNote}>
        You can leave this screen: pairing carries on while Revive ST is open.
      </Text>
    </>
  );
}

export function PairFailedView({
  view,
  target,
  serverHost,
  onRetry,
  onClose,
  onShowLogs,
}: {
  view: Extract<PairView, { kind: "failed" }>;
  target: PairTarget;
  serverHost: string;
  onRetry: () => void;
  onClose: () => void;
  onShowLogs: () => void;
}) {
  const copy = describePairError(view.error, target, serverHost);
  return (
    <>
      <SetupHeader
        overline={target.name}
        icon={ERROR_ICON}
        tone="error"
        title={copy.title}
        description={copy.message}
      />
      <Card style={$setupCard}>
        <StepList steps={steps(view.step, "error", undefined, copy.title)} />
      </Card>
      <View style={$setupButtons}>
        <Button label="Try again" icon={icons.refresh} onPress={onRetry} />
        <Button label="Close" variant="secondary" onPress={onClose} />
        <Button label="Show logs" variant="ghost" onPress={onShowLogs} />
      </View>
    </>
  );
}

export function PairDoneView({
  view,
  target,
  onDone,
}: {
  view: Extract<PairView, { kind: "done" }>;
  target: PairTarget;
  onDone: () => void;
}) {
  return (
    <>
      <SetupHeader
        overline={view.group.name}
        icon={SUCCESS_ICON}
        tone="success"
        title="Paired"
        description={`${target.left.name} and ${target.right.name} now play as one stereo pair. Volume, power and source set on either speaker apply to both.`}
      />
      <Card style={$setupCard}>
        <StepList steps={steps("confirm", "done")} />
      </Card>
      <View style={$setupButtons}>
        <Button label="Done" onPress={onDone} />
      </View>
    </>
  );
}

const $elapsed: TextStyle = {
  fontVariant: ["tabular-nums"],
};
