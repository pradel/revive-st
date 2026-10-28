import { SymbolView } from "expo-symbols";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { COLORS } from "@/ui/theme";

import type { StepId, WorkingDetail } from "../session/types";
import {
  $setupCard,
  $setupCardTitle,
  $setupEmphasis,
  SetupButton,
  SetupHeader,
  type SymbolName,
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
  icon: SymbolName;
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
            Connecting to <Text style={$setupEmphasis}>{detail.ssid}</Text>. If
            Android asks whether to connect to a device, tap{" "}
            <Text style={$setupEmphasis}>Connect</Text>.
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
            Connected to <Text style={$setupEmphasis}>{detail.ssid}</Text>.
            Waiting for the speaker to answer…
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
            Speaker is joining <Text style={$setupEmphasis}>{detail.ssid}</Text>
            … This can take up to 40 seconds.
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
            <Text style={$setupEmphasis}>{detail.ssid}</Text>…
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
            <Text style={$setupEmphasis}>{detail.ssid}</Text>…
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
            Renaming the speaker to{" "}
            <Text style={$setupEmphasis}>{detail.name}</Text>…
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
      <Text style={$setupCardTitle}>Not showing up?</Text>
      <CheckItem>
        The speaker's Wi-Fi light is{" "}
        <Text style={$setupEmphasis}>solid amber</Text>. If not, hold{" "}
        <Text style={$setupEmphasis}>2</Text> and{" "}
        <Text style={$setupEmphasis}>Volume −</Text> for about 5 seconds.
      </CheckItem>
      <CheckItem>The phone is within a few metres of the speaker.</CheckItem>
      <CheckItem>
        A speaker that is already set up has a{" "}
        <Text style={$setupEmphasis}>white</Text> light and won't appear here.
        To start from scratch, factory reset it: hold{" "}
        <Text style={$setupEmphasis}>1</Text> and{" "}
        <Text style={$setupEmphasis}>Volume −</Text> for 10 seconds.
      </CheckItem>
      <View style={$helpButton}>
        <SetupButton
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
      <SymbolView
        name={{
          ios: "questionmark.circle",
          android: "help",
          web: "help",
        }}
        tintColor={COLORS.textSecondary}
        size={18}
      />
      <Text style={$checkText}>{children}</Text>
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
          <SetupButton
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
        {STAGES.map((stage, index) => {
          const status =
            index < current ? "done" : index === current ? "active" : "pending";
          return (
            <View key={stage.title} style={$stepRow}>
              <View style={$stepIcon}>
                {status === "active" ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <SymbolView
                    name={
                      status === "done"
                        ? {
                            ios: "checkmark.circle.fill",
                            android: "check_circle",
                            web: "check_circle",
                          }
                        : {
                            ios: "circle",
                            android: "radio_button_unchecked",
                            web: "radio_button_unchecked",
                          }
                    }
                    tintColor={
                      status === "done" ? COLORS.primary : COLORS.textDisabled
                    }
                    size={20}
                  />
                )}
              </View>
              <View style={$stepText}>
                <Text
                  style={[
                    $stepTitle,
                    status === "active" && $stepTitleActive,
                    status === "done" && $stepTitleDone,
                  ]}
                >
                  {stage.title}
                </Text>
                {status !== "done" && (
                  <Text style={$stepHint}>{stage.hint}</Text>
                )}
              </View>
              {status === "active" && (
                <Text style={$elapsed}>{formatElapsed(elapsed)}</Text>
              )}
            </View>
          );
        })}
      </Card>
    </>
  );
}

const $wifiButton: ViewStyle = {
  width: "100%",
  marginBottom: 20,
};

const $stepRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  paddingVertical: 8,
};

const $stepIcon: ViewStyle = {
  width: 24,
  alignItems: "center",
};

const $stepText: ViewStyle = {
  flex: 1,
};

const $stepTitle: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
};

const $stepTitleActive: TextStyle = {
  color: COLORS.text,
  fontWeight: "600",
};

const $stepTitleDone: TextStyle = {
  color: COLORS.textSecondary,
};

const $elapsed: TextStyle = {
  fontSize: 13,
  color: COLORS.primary,
  fontVariant: ["tabular-nums"],
};

const $stepHint: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  marginTop: 2,
};

const $progress: ViewStyle = {
  width: "100%",
  marginBottom: 20,
};

const $progressTrack: ViewStyle = {
  height: 6,
  borderRadius: 3,
  backgroundColor: COLORS.border,
  overflow: "hidden",
};

const $progressFill: ViewStyle = {
  height: "100%",
  borderRadius: 3,
  backgroundColor: COLORS.primary,
};

const $helpButton: ViewStyle = {
  marginTop: 4,
};

const $checkRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const $checkText: TextStyle = {
  flex: 1,
  color: COLORS.textSecondary,
  fontSize: 14,
  lineHeight: 20,
};
