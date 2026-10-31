import { type ReactNode, useEffect, useState } from "react";
import { View, type TextStyle, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import {
  $setupButtons,
  $setupCard,
  $setupCardTitle,
  $setupNote,
  Emphasis,
  SetupHeader,
} from "@/features/onboarding/components/SetupLayout";
import { Button } from "@/ui/ds/Button";
import { Icon, type IconName, icons } from "@/ui/ds/Icon";
import { StepList, type StepListItem } from "@/ui/ds/StepList";
import { Text } from "@/ui/ds/Text";
import { space } from "@/ui/tokens";

import { describeError } from "../session/errors";
import {
  type ConfigureView,
  type RecoveryAction,
  STEP_IDS,
  type StepId,
  type WorkingDetail,
} from "../session/types";

const STEP_TITLES: Record<StepId, string> = {
  prepare: "Save your presets",
  connect: "Connect to Revive ST",
  restart: "Restart the speaker",
  verify: "Check internet radio",
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

interface DetailCopy {
  icon: IconName;
  title: string;
  description: string;
}

function detailCopy(
  detail: WorkingDetail,
  speakerName: string,
  serverHost: string,
): DetailCopy {
  switch (detail.kind) {
    case "checkingSpeaker": {
      return {
        icon: icons.speaker,
        title: `Checking ${speakerName}`,
        description: "Making sure the speaker and Revive ST both answer.",
      };
    }
    case "savingPresets": {
      return {
        icon: icons.star,
        title: "Saving your presets",
        description: `Copying ${speakerName}'s presets to Revive ST so they're kept.`,
      };
    }
    case "writingSettings": {
      return {
        icon: icons.radio,
        title: `Connecting ${speakerName}`,
        description: `Giving the speaker the address of ${serverHost}.`,
      };
    }
    case "pairing": {
      return {
        icon: icons.lock,
        title: "Linking your account",
        description: `Pairing ${speakerName} with your household's Revive ST account.`,
      };
    }
    case "refreshingSources": {
      return {
        icon: icons.radio,
        title: "Loading radio services",
        description: `${speakerName} is fetching the radio services Revive ST offers.`,
      };
    }
    case "restarting":
    case "waitingForShutdown": {
      return {
        icon: icons.refresh,
        title: `Restarting ${speakerName}`,
        description:
          "The speaker switches off for a moment, which stops what's playing.",
      };
    }
    case "waitingForSpeaker": {
      return {
        icon: icons.refresh,
        title: `Waiting for ${speakerName}`,
        description:
          "Restarting can take a minute or two. The Wi-Fi light turns solid white once the speaker is back.",
      };
    }
    case "checkingSettings": {
      return {
        icon: icons.search,
        title: "Checking the new settings",
        description: `Making sure ${speakerName} kept Revive ST's address and your account.`,
      };
    }
    case "waitingForServer": {
      return {
        icon: icons.radio,
        title: "Waiting for Revive ST",
        description: `Waiting for ${speakerName} to contact ${serverHost}.`,
      };
    }
    default: {
      const unhandled: never = detail;
      throw new Error(`Unhandled detail ${JSON.stringify(unhandled)}`);
    }
  }
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Milliseconds since `startedAt`, updated once a second. */
function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);
  return Math.max(0, now - startedAt);
}

function steps(
  current: StepId,
  status: "active" | "error" | "done",
  trailing?: { text: string; label: string },
  errorTitle?: string,
): StepListItem[] {
  const currentIndex = STEP_IDS.indexOf(current);
  return STEP_IDS.map((step, index) => {
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

function WhatHappensItem({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <View style={$itemRow}>
      <Icon name={icon} size={18} />
      <Text variant="body" color="textSecondary" style={$flex}>
        {children}
      </Text>
    </View>
  );
}

/** What setting up does, and the explicit go-ahead. */
export function IntroView({
  speakerName,
  serverHost,
  alreadySetUp,
  onStart,
  onCancel,
}: {
  speakerName: string;
  serverHost: string;
  /** The speaker already uses this server: setting it up refreshes its settings. */
  alreadySetUp: boolean;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <SetupHeader
        overline={speakerName}
        icon={icons.radio}
        title={alreadySetUp ? "Set up again" : "Set up internet radio"}
        description={
          alreadySetUp ? (
            <>
              {speakerName} already uses{" "}
              <Emphasis>Revive ST ({serverHost})</Emphasis>. Setting it up again
              rewrites its settings, which fixes a speaker that lost them and
              adds radio sources added since.
            </>
          ) : (
            <>
              Internet radio and presets on SoundTouch speakers rely on an
              online service. This switches {speakerName} to{" "}
              <Emphasis>Revive ST ({serverHost})</Emphasis>.
            </>
          )
        }
      />
      <Card style={$setupCard}>
        <Text variant="headline" style={$setupCardTitle}>
          What happens
        </Text>
        <WhatHappensItem icon={icons.star}>
          Your presets are saved to Revive ST first, so they're kept.
        </WhatHappensItem>
        <WhatHappensItem icon={icons.radio}>
          {speakerName} gets Revive ST's address for radio, presets and software
          updates, and is linked to your household's account.
        </WhatHappensItem>
        <WhatHappensItem icon={icons.refresh}>
          {speakerName} <Emphasis>restarts once</Emphasis>. It takes a minute or
          two and stops what's playing.
        </WhatHappensItem>
        <WhatHappensItem icon={icons.lock}>
          Keep this phone on the same Wi-Fi and Revive ST open until it's done.
        </WhatHappensItem>
      </Card>
      <View style={$setupButtons}>
        <Button
          label={`Set up ${speakerName}`}
          icon={icons.radio}
          onPress={onStart}
        />
        <Button label="Not now" variant="secondary" onPress={onCancel} />
        <Text variant="caption" color="textTertiary" style={$setupNote}>
          You can set it up again at any time, for example after changing server
          in Settings.
        </Text>
      </View>
    </>
  );
}

export function WorkingView({
  view,
  speakerName,
  serverHost,
}: {
  view: Extract<ConfigureView, { kind: "working" }>;
  speakerName: string;
  serverHost: string;
}) {
  const elapsed = useElapsed(view.startedAt);
  const copy = detailCopy(view.detail, speakerName, serverHost);
  const seconds = Math.floor(elapsed / 1000);
  return (
    <>
      <SetupHeader
        overline={speakerName}
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
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
        You can leave this screen: setup carries on while Revive ST is open.
      </Text>
    </>
  );
}

const ACTION_LABELS: Record<RecoveryAction, { label: string; icon: IconName }> =
  {
    checkAgain: { label: "Check again", icon: icons.search },
    retry: { label: "Try again", icon: icons.refresh },
  };

export function FailedView({
  view,
  speakerName,
  serverHost,
  onAction,
  onClose,
  onShowLogs,
}: {
  view: Extract<ConfigureView, { kind: "failed" }>;
  speakerName: string;
  serverHost: string;
  onAction: (action: RecoveryAction) => void;
  onClose: () => void;
  onShowLogs: () => void;
}) {
  const copy = describeError(view.error, speakerName, serverHost);
  return (
    <>
      <SetupHeader
        overline={speakerName}
        icon={ERROR_ICON}
        tone="error"
        title={copy.title}
        description={copy.message}
      />
      <Card style={$setupCard}>
        <StepList steps={steps(view.step, "error", undefined, copy.title)} />
      </Card>
      <View style={$setupButtons}>
        {view.actions.map((action, index) => (
          <Button
            key={action}
            label={ACTION_LABELS[action].label}
            icon={ACTION_LABELS[action].icon}
            variant={index === 0 ? "primary" : "secondary"}
            onPress={() => {
              onAction(action);
            }}
          />
        ))}
        <Button label="Close" variant="secondary" onPress={onClose} />
        <Button label="Show logs" variant="ghost" onPress={onShowLogs} />
      </View>
    </>
  );
}

export function DoneView({
  view,
  speakerName,
  serverHost,
  onDone,
}: {
  view: Extract<ConfigureView, { kind: "done" }>;
  speakerName: string;
  serverHost: string;
  onDone: () => void;
}) {
  return (
    <>
      <SetupHeader
        overline={speakerName}
        icon={SUCCESS_ICON}
        tone="success"
        title={`${speakerName} is ready`}
        description={
          view.serverConfirmed
            ? `It restarted and reached ${serverHost}. Internet radio and presets now go through Revive ST.`
            : `It restarted with Revive ST's settings. ${serverHost} can't confirm the speaker reached it: update the server to get that check.`
        }
      />
      <Card style={$setupCard}>
        <StepList steps={steps("verify", "done")} />
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

const $itemRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
  marginBottom: space.sm,
};

const $flex: TextStyle = {
  flex: 1,
};
