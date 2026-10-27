import { type ReactNode, useEffect, useState } from "react";
import { View, type TextStyle, type ViewStyle } from "react-native";

import { Card } from "@/components/ui/Card";
import { Button } from "@/ui/ds/Button";
import { Icon, type IconName } from "@/ui/ds/Icon";
import { StepList } from "@/ui/ds/StepList";
import { Text } from "@/ui/ds/Text";
import { color, radius, space } from "@/ui/tokens";

import type { StepId, WorkingDetail } from "../session/types";
import {
  $setupCard,
  $setupCardTitle,
  Emphasis,
  SetupHeader,
} from "./SetupLayout";

/** The steps grouped into what the user sees as progress. */
const STAGES: { title: string; hint: string; steps: StepId[] }[] = [
  {
    title: "Connect to speaker",
    hint: "about 10 s",
    steps: ["preflight", "findSpeaker", "join"],
  },
  {
    title: "Send Wi-Fi details",
    hint: "up to 40 s",
    steps: ["credentials", "deliver"],
  },
  {
    title: "Finish",
    hint: "about 20 s",
    steps: ["leaveSetup", "rejoinHome", "verify", "name"],
  },
];

/** The speaker gives up joining after 30 s and answers a few seconds later. */
const DELIVER_EXPECTED_MS = 40_000;

/** How long the speaker search runs before suggesting what to check. */
const FIND_SPEAKER_HELP_MS = 30_000;

interface DetailCopy {
  icon: IconName;
  title: string;
  description: ReactNode;
}

function detailCopy(detail: WorkingDetail): DetailCopy {
  switch (detail.kind) {
    case "starting":
    case "checkingPermissions": {
      return {
        icon: { ios: "location", android: "location_on", web: "location_on" },
        title: "Getting ready",
        description: "Checking location access and Wi-Fi…",
      };
    }
    case "wifiOff": {
      return {
        icon: { ios: "wifi.slash", android: "wifi_off", web: "wifi_off" },
        title: "Turn on Wi-Fi",
        description:
          "Wi-Fi is off. Turn it on to look for your speaker; setup continues by itself.",
      };
    }
    case "scanning": {
      return {
        icon: { ios: "wifi", android: "wifi_find", web: "wifi_find" },
        title: "Looking for your speaker",
        description:
          detail.attempt > 1
            ? `Still looking (scan ${detail.attempt}). Make sure the speaker's Wi-Fi light is solid amber.`
            : "Looking for a speaker in setup mode nearby…",
      };
    }
    case "joining": {
      return {
        icon: { ios: "link", android: "link", web: "link" },
        title: "Connecting to the speaker",
        description: (
          <>
            Connecting to <Emphasis>{detail.ssid}</Emphasis>. If Android asks
            whether to connect to a device, tap <Emphasis>Connect</Emphasis>.
          </>
        ),
      };
    }
    case "connectingManually": {
      return {
        icon: { ios: "link", android: "link", web: "link" },
        title: "Connecting to the speaker",
        description: "Checking the connection to the speaker's network…",
      };
    }
    case "probing": {
      return {
        icon: { ios: "link", android: "link", web: "link" },
        title: "Connecting to the speaker",
        description: (
          <>
            Connected to <Emphasis>{detail.ssid}</Emphasis>. Waiting for the
            speaker to answer…
          </>
        ),
      };
    }
    case "loadingNetworks": {
      return {
        icon: { ios: "wifi", android: "wifi", web: "wifi" },
        title: "Looking for Wi-Fi networks",
        description: "Finding the networks your speaker can join…",
      };
    }
    case "delivering": {
      return {
        icon: { ios: "paperplane", android: "send", web: "send" },
        title: "Joining your Wi-Fi",
        description: (
          <>
            Speaker is joining <Emphasis>{detail.ssid}</Emphasis>… This can take
            up to 40 seconds.
          </>
        ),
      };
    }
    case "confirming": {
      return {
        icon: { ios: "paperplane", android: "send", web: "send" },
        title: "Joining your Wi-Fi",
        description: (
          <>
            Checking whether the speaker joined{" "}
            <Emphasis>{detail.ssid}</Emphasis>…
          </>
        ),
      };
    }
    case "leavingSetup": {
      return {
        icon: { ios: "checkmark.seal", android: "verified", web: "verified" },
        title: "Finishing setup",
        description: "Taking the speaker out of setup mode…",
      };
    }
    case "waitingForHomeWifi": {
      return {
        icon: { ios: "iphone", android: "smartphone", web: "smartphone" },
        title: "Reconnecting your phone",
        description: (
          <>
            Waiting for your phone to reconnect to{" "}
            <Emphasis>{detail.ssid}</Emphasis>…
          </>
        ),
      };
    }
    case "verifying": {
      return {
        icon: {
          ios: "magnifyingglass",
          android: "search",
          web: "search",
        },
        title: "Finding your speaker",
        description: "Looking for the speaker on your home network…",
      };
    }
    case "renaming": {
      return {
        icon: { ios: "pencil", android: "edit", web: "edit" },
        title: "Naming your speaker",
        description: (
          <>
            Renaming the speaker to <Emphasis>{detail.name}</Emphasis>…
          </>
        ),
      };
    }
    default: {
      return detail satisfies never;
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

/** What to check when no speaker shows up, and the manual way in. */
function FindSpeakerHelp({ onManualJoin }: { onManualJoin: () => void }) {
  return (
    <Card style={$setupCard}>
      <Text variant="headline" style={$setupCardTitle}>
        Not showing up?
      </Text>
      <CheckItem>
        The speaker's Wi-Fi light is <Emphasis>solid amber</Emphasis>. If not,
        hold <Emphasis>2</Emphasis> and <Emphasis>Volume −</Emphasis> for about
        5 seconds.
      </CheckItem>
      <CheckItem>The phone is within a few metres of the speaker.</CheckItem>
      <CheckItem>
        A speaker that is already set up has a <Emphasis>white</Emphasis> light
        and won't appear here. To start from scratch, factory reset it: hold{" "}
        <Emphasis>1</Emphasis> and <Emphasis>Volume −</Emphasis> for 10 seconds.
      </CheckItem>
      <View style={$helpButton}>
        <Button
          label="Connect manually"
          variant="secondary"
          icon={{ ios: "hand.tap", android: "touch_app", web: "touch_app" }}
          onPress={onManualJoin}
        />
      </View>
    </Card>
  );
}

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <View style={$checkRow}>
      <Icon
        name={{
          ios: "questionmark.circle",
          android: "help",
          web: "help",
        }}
        size={18}
      />
      <Text variant="body" color="textSecondary" style={$flex}>
        {children}
      </Text>
    </View>
  );
}

/** Determinate bar for a wait with a known upper bound. */
function ProgressBar({ fraction }: { fraction: number }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <View
      style={$progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[$progressFill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

interface WorkingViewProps {
  step: StepId;
  detail: WorkingDetail;
  startedAt: number;
  onEnableWifi: () => void;
  /** Only offered while looking for the speaker. */
  onManualJoin: () => void;
}

export function WorkingView({
  step,
  detail,
  startedAt,
  onEnableWifi,
  onManualJoin,
}: WorkingViewProps) {
  const elapsed = useElapsed(startedAt);
  const copy = detailCopy(detail);
  const current = STAGES.findIndex((stage) => stage.steps.includes(step));
  const showFindHelp =
    step === "findSpeaker" &&
    detail.kind !== "wifiOff" &&
    elapsed >= FIND_SPEAKER_HELP_MS;

  return (
    <>
      <SetupHeader
        icon={copy.icon}
        title={copy.title}
        description={copy.description}
      />

      {detail.kind === "wifiOff" && (
        <View style={$wifiButton}>
          <Button
            label="Turn on Wi-Fi"
            icon={{ ios: "wifi", android: "wifi", web: "wifi" }}
            onPress={onEnableWifi}
          />
        </View>
      )}

      {detail.kind === "delivering" && (
        <View style={$progress}>
          <ProgressBar fraction={elapsed / DELIVER_EXPECTED_MS} />
        </View>
      )}

      {showFindHelp && <FindSpeakerHelp onManualJoin={onManualJoin} />}

      <Card style={$setupCard}>
        <StepList
          steps={STAGES.map((stage, index) => {
            const status =
              index < current
                ? "done"
                : index === current
                  ? "active"
                  : "pending";
            return {
              id: stage.title,
              title: stage.title,
              status,
              description: status === "done" ? undefined : stage.hint,
              trailing:
                status === "active" ? (
                  <Text variant="subhead" color="accent" style={$elapsed}>
                    {formatElapsed(elapsed)}
                  </Text>
                ) : undefined,
            };
          })}
        />
      </Card>
    </>
  );
}

const $wifiButton: ViewStyle = {
  width: "100%",
  marginBottom: space.lg,
};

const $elapsed: TextStyle = {
  fontVariant: ["tabular-nums"],
};

const $progress: ViewStyle = {
  width: "100%",
  marginBottom: space.lg,
};

const $progressTrack: ViewStyle = {
  height: 6,
  borderRadius: radius.pill,
  backgroundColor: color.surface2,
  overflow: "hidden",
};

const $progressFill: ViewStyle = {
  height: "100%",
  borderRadius: radius.pill,
  backgroundColor: color.accent,
};

const $helpButton: ViewStyle = {
  marginTop: space.xxs,
};

const $checkRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
  marginBottom: space.sm,
};

const $flex: TextStyle = {
  flex: 1,
};
