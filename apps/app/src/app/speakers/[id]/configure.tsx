import { useQueryClient } from "@tanstack/react-query";
import type { SocketModuleLike } from "bose-api-speaker-client";
import {
  Stack,
  useLocalSearchParams,
  usePreventRemove,
  useRouter,
} from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  View,
  type ScrollViewInstance,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import TcpSocket from "react-native-tcp-socket";

import { KeepAwake } from "@/components/KeepAwake";
import { Card } from "@/components/ui/Card";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import {
  checkMargeAPIStatus,
  configureMargeAPI,
} from "@/features/speakers/lib/telnet";
import { haptics } from "@/lib/haptics";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { Icon, icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { SectionHeader } from "@/ui/ds/SectionHeader";
import { StepList, type StepListItem, type StepStatus } from "@/ui/ds/StepList";
import { Text } from "@/ui/ds/Text";
import { color, space, type ColorName } from "@/ui/tokens";

interface LogLine {
  id: string;
  text: string;
  type: "info" | "success" | "error" | "debug";
  timestamp: string;
}

interface Step {
  id: string;
  label: string;
}

type ConfigState =
  | { status: "idle" }
  | { status: "running"; currentStepIndex: number; rebootTimer: number | null }
  | { status: "success" }
  | { status: "error"; currentStepIndex: number; errorDetails: string };

const INITIAL_STEPS: Step[] = [
  { id: "telnet_connect", label: "Connecting via Telnet (port 17000)" },
  { id: "set_registry", label: "Setting BMX registry URL" },
  { id: "set_redirect", label: "Configuring boseurls redirect" },
  { id: "set_account", label: "Configuring account environment" },
  { id: "pair_device", label: "Pairing speaker with account" },
  { id: "reboot", label: "Triggering speaker reboot" },
  { id: "wait_online", label: "Waiting for speaker to restart" },
];

export default function ConfigureSpeaker() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { speakers } = useBose();
  const speaker = speakers.find((item) => item.deviceID === id);
  const queryClient = useQueryClient();

  const [logs, setLogs] = useState<LogLine[]>([]);
  const [configState, setConfigState] = useState<ConfigState>({
    status: "idle",
  });

  const logsEndRef = useRef<ScrollViewInstance | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addLog = (text: string, type: LogLine["type"] = "info") => {
    if (!isMountedRef.current) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    const logId = `${Date.now()}-${Math.random()}`;
    setLogs((prev) => [...prev, { id: logId, text, type, timestamp }]);
    setTimeout(() => {
      logsEndRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const runConfiguration = async () => {
    if (!speaker) {
      addLog("Error: Speaker details not found.", "error");
      return;
    }

    setConfigState({
      status: "running",
      currentStepIndex: 0,
      rebootTimer: null,
    });
    setLogs([]);

    addLog(`Starting configuration for ${speaker.name} (${speaker.host})...`);

    let activeStepIndex = 0;

    try {
      const configResult = await configureMargeAPI(
        speaker.host,
        TcpSocket as unknown as SocketModuleLike,
        {
          onLog: (text, type) => {
            addLog(text, type);
          },
          onStepStart: (stepId) => {
            const stepIndex = INITIAL_STEPS.findIndex((s) => s.id === stepId);
            if (stepIndex !== -1) {
              activeStepIndex = stepIndex;
              setConfigState({
                status: "running",
                currentStepIndex: stepIndex,
                rebootTimer: null,
              });
            }
          },
        },
      );

      if (!configResult.isOk()) {
        throw configResult.error;
      }

      // Step 7: Wait for speaker to come back online
      activeStepIndex = 6;
      setConfigState({
        status: "running",
        currentStepIndex: 6,
        rebootTimer: 90,
      });
      addLog("Waiting for speaker to disconnect and reboot...");

      // Wait 10 seconds before starting checks to allow speaker to shut down
      let countdown = 90;

      const countdownInterval = setInterval(() => {
        if (!isMountedRef.current) {
          clearInterval(countdownInterval);
          return;
        }
        countdown--;
        const currentCountdown = countdown > 0 ? countdown : 0;
        setConfigState((prev) =>
          prev.status === "running"
            ? { ...prev, rebootTimer: currentCountdown }
            : prev,
        );
      }, 1000);

      // Poll checkMargeAPIStatus until back online
      let online = false;
      const startTime = Date.now();
      // 2 minutes max polling
      const timeout = 120000;

      // Delay first check by 12 seconds
      await new Promise((resolve) => setTimeout(resolve, 12000));

      while (Date.now() - startTime < timeout) {
        if (!isMountedRef.current) {
          clearInterval(countdownInterval);
          return;
        }
        addLog("Polling speaker availability...");
        try {
          // eslint-disable-next-line no-await-in-loop
          const isUp = await checkMargeAPIStatus(speaker.host);
          if (isUp) {
            online = true;
            break;
          }
        } catch {
          // Keep polling
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      clearInterval(countdownInterval);

      if (online) {
        addLog("Speaker is back online and fully configured!", "success");
        void queryClient.invalidateQueries({
          queryKey: ["marge-api-status", speaker.host],
        });
        haptics.success();
        setConfigState({ status: "success" });
      } else {
        throw new Error(
          "Speaker reboot timed out. It is taking longer than expected to join the network.",
        );
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog(`Error: ${msg}`, "error");

      // Determine failed step
      const stepIds = [
        "telnet_connect",
        "set_registry",
        "set_redirect",
        "set_account",
        "pair_device",
        "reboot",
        "wait_online",
      ];
      const failedStepId = stepIds[activeStepIndex] || "telnet_connect";

      // Formulate useful user suggestions
      let suggestion =
        "Ensure your phone is connected to the same Wi-Fi network.";
      if (failedStepId === "telnet_connect") {
        suggestion =
          "Failed to establish Telnet. Confirm the speaker is powered on and connected to your Wi-Fi router. Verify its IP matches and port 17000 is not blocked.";
      } else if (failedStepId === "pair_device") {
        suggestion =
          "HTTP pairing failed. Make sure the speaker is fully powered up and that its HTTP server on port 8090 is accessible.";
      } else if (failedStepId === "wait_online") {
        suggestion =
          "The speaker did not re-join the network in time. Check the speaker LED. If it has a solid Wi-Fi light, try hitting 'Retry Connection' in settings.";
      }

      haptics.error();
      setConfigState({
        status: "error",
        currentStepIndex: activeStepIndex,
        errorDetails: `${msg}\nSuggestion: ${suggestion}`,
      });
    }
  };

  const goBack = () => {
    router.back();
  };

  const isRunning = configState.status === "running";
  const [leaving, setLeaving] = useState(false);

  // Leaving doesn't undo the telnet steps or stop the reboot; it only hides
  // their progress and outcome, so ask before going back mid-run.
  usePreventRemove(isRunning && !leaving, ({ repeat }) => {
    Alert.alert(
      "Leave configuration?",
      "The speaker is being configured and may be rebooting. Leaving won't stop it, but you won't see whether it worked.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            setLeaving(true);
            repeat();
          },
        },
      ],
    );
  });

  if (!speaker) {
    return (
      <Screen>
        <Stack.Title>Configure</Stack.Title>
        <EmptyState
          icon={icons.speaker}
          title="Speaker not found"
          actions={
            <Button label="Go Back" variant="secondary" onPress={goBack} />
          }
        />
      </Screen>
    );
  }

  // Derive helper variables and step checklist statuses from single state
  const isFinished = configState.status === "success";
  const hasErrors = configState.status === "error";
  const rebootTimer =
    configState.status === "running" ? configState.rebootTimer : null;

  const steps: StepListItem[] = INITIAL_STEPS.map((step, index) => {
    let status: StepStatus = "pending";
    let description: string | undefined = undefined;

    if (configState.status === "success") {
      status = "done";
    } else if (
      configState.status === "running" ||
      configState.status === "error"
    ) {
      if (index < configState.currentStepIndex) {
        status = "done";
      } else if (index === configState.currentStepIndex) {
        if (configState.status === "running") {
          status = "active";
        } else {
          status = "error";
          description = configState.errorDetails;
        }
      }
    }

    return {
      id: step.id,
      title: step.label,
      status,
      description,
      trailing:
        step.id === "wait_online" && rebootTimer !== null ? (
          <Text variant="subhead" color="textSecondary" style={$countdown}>
            {rebootTimer}s
          </Text>
        ) : undefined,
    };
  });

  return (
    <Screen>
      <Stack.Title>Configure</Stack.Title>
      {isRunning && <KeepAwake />}
      <ScrollView
        contentContainerStyle={$content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Header summary */}
        <View style={$section}>
          <Card style={$headerCard}>
            <Icon name={icons.settings} size={32} />
            <Text variant="headline" style={$centered}>
              Pairing with Revive ST Marge API
            </Text>
            <Text variant="subhead" color="textSecondary" style={$centered}>
              {speaker.name} · {speaker.host}
            </Text>
          </Card>
        </View>

        {/* Steps Tracker */}
        <SectionHeader title="Progress" />
        <View style={$section}>
          <Card>
            <StepList steps={steps} />
          </Card>
        </View>

        {/* Console Log */}
        <SectionHeader title="Logs" />
        <View style={$section}>
          <Card>
            <ScrollView
              ref={logsEndRef}
              style={$consoleScroll}
              contentContainerStyle={$consoleContent}
              nestedScrollEnabled
            >
              {logs.length === 0 ? (
                <Text color="textTertiary" style={$logText}>
                  {configState.status === "idle"
                    ? "Ready to start configuration..."
                    : "Initializing steps..."}
                </Text>
              ) : (
                logs.map((log) => (
                  <Text
                    key={log.id}
                    color={LOG_COLOR[log.type]}
                    style={$logText}
                  >
                    <Text color="textTertiary" style={$logText}>
                      {log.timestamp}
                    </Text>{" "}
                    - {log.text}
                  </Text>
                ))
              )}
            </ScrollView>
          </Card>
        </View>

        {/* Actions */}
        <View style={[$section, $actions]}>
          {configState.status === "idle" && (
            <Button
              label="Start Configuration"
              onPress={() => void runConfiguration()}
            />
          )}

          {isFinished && <Button label="Done" onPress={goBack} />}

          {hasErrors && (
            <>
              <Button
                label="Retry Configuration"
                icon={icons.refresh}
                onPress={() => void runConfiguration()}
              />
              <Button label="Go Back" variant="secondary" onPress={goBack} />
            </>
          )}

          {isRunning && !isFinished && (
            <View style={$runningBanner}>
              <ActivityIndicator size="small" color={color.textSecondary} />
              <Text variant="caption" color="textSecondary">
                Configuring speaker, please keep the app open...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const LOG_COLOR: Record<LogLine["type"], ColorName> = {
  info: "textSecondary",
  success: "accent",
  error: "danger",
  debug: "textTertiary",
};

const $content: ViewStyle = {
  paddingBottom: space.xxxl,
};

const $section: ViewStyle = {
  paddingHorizontal: space.screen,
};

const $headerCard: ViewStyle = {
  alignItems: "center",
  gap: space.xs,
  paddingVertical: space.xl,
};

const $centered: TextStyle = {
  textAlign: "center",
};

const $countdown: TextStyle = {
  fontVariant: ["tabular-nums"],
};

const $consoleScroll: ViewStyle = {
  height: 160,
};

const $consoleContent: ViewStyle = {
  gap: space.xxs,
};

const $logText: TextStyle = {
  fontFamily: "monospace",
  fontSize: 11,
  lineHeight: 15,
};

const $actions: ViewStyle = {
  marginTop: space.xl,
  gap: space.sm,
};

const $runningBanner: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: space.xs,
  paddingVertical: space.sm,
};
