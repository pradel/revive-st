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
  $setupEmphasis,
  SetupButton,
  SetupHeader,
  type SymbolName,
} from "./SetupLayout";

const STEPS: { id: StepId; title: string }[] = [
  { id: "preflight", title: "Checking permissions" },
  { id: "findSpeaker", title: "Finding your speaker" },
  { id: "join", title: "Connecting to the speaker" },
  { id: "credentials", title: "Choosing your Wi-Fi" },
  { id: "deliver", title: "Sending the Wi-Fi details" },
  { id: "leaveSetup", title: "Leaving setup mode" },
  { id: "rejoinHome", title: "Reconnecting your phone" },
  { id: "verify", title: "Finding the speaker on your network" },
];

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
            … This can take up to 30 seconds.
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

interface WorkingViewProps {
  step: StepId;
  detail: WorkingDetail;
  startedAt: number;
  onEnableWifi: () => void;
}

export function WorkingView({
  step,
  detail,
  startedAt,
  onEnableWifi,
}: WorkingViewProps) {
  const elapsed = useElapsed(startedAt);
  const copy = detailCopy(detail);
  const current = STEPS.findIndex((entry) => entry.id === step);

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

      <Card style={$setupCard}>
        {STEPS.map((entry, index) => {
          const status =
            index < current ? "done" : index === current ? "active" : "pending";
          return (
            <View key={entry.id} style={$stepRow}>
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
              <Text
                style={[
                  $stepTitle,
                  status === "active" && $stepTitleActive,
                  status === "done" && $stepTitleDone,
                ]}
              >
                {entry.title}
              </Text>
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

const $stepTitle: TextStyle = {
  flex: 1,
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
