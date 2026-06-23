import { useQueryClient } from "@tanstack/react-query";
import type { SocketModuleLike } from "bose-api-speaker-client";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import TcpSocket from "react-native-tcp-socket";

import { Card } from "@/components/ui/Card";
import { useBose } from "@/features/speakers/contexts/BoseContext";
import {
  checkMargeAPIStatus,
  configureMargeAPI,
} from "@/features/speakers/lib/telnet";
import { COLORS } from "@/ui/theme";

interface LogLine {
  id: string;
  text: string;
  type: "info" | "success" | "error" | "debug";
  timestamp: string;
}

interface Step {
  id: string;
  label: string;
  status: "idle" | "running" | "success" | "error";
  errorDetails?: string;
}

type ConfigState =
  | { status: "idle" }
  | { status: "running"; currentStepIndex: number; rebootTimer: number | null }
  | { status: "success" }
  | { status: "error"; currentStepIndex: number; errorDetails: string };

const INITIAL_STEPS: Step[] = [
  {
    id: "telnet_connect",
    label: "Connecting via Telnet (port 17000)",
    status: "idle",
  },
  { id: "set_registry", label: "Setting BMX registry URL", status: "idle" },
  {
    id: "set_redirect",
    label: "Configuring boseurls redirect",
    status: "idle",
  },
  {
    id: "set_account",
    label: "Configuring account environment",
    status: "idle",
  },
  { id: "pair_device", label: "Pairing speaker with account", status: "idle" },
  { id: "reboot", label: "Triggering speaker reboot", status: "idle" },
  {
    id: "wait_online",
    label: "Waiting for speaker to restart",
    status: "idle",
  },
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

  const logsEndRef = useRef<ScrollView | null>(null);
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

      setConfigState({
        status: "error",
        currentStepIndex: activeStepIndex,
        errorDetails: `${msg}\nSuggestion: ${suggestion}`,
      });
    }
  };

  useEffect(() => {
    if (speaker) {
      void runConfiguration();
    } else {
      addLog("Speaker not resolved.", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!speaker) {
    return (
      <View style={$container}>
        <Stack.Screen options={{ title: "Configure Speaker" }} />
        <View style={$centerState}>
          <Text style={$notFoundText}>Speaker not found</Text>
          <TouchableOpacity
            onPress={() => {
              router.back();
            }}
            style={$backButton}
          >
            <Text style={$backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Derive helper variables and step checklist statuses from single state
  const isRunning = configState.status === "running";
  const isFinished = configState.status === "success";
  const hasErrors = configState.status === "error";
  const rebootTimer =
    configState.status === "running" ? configState.rebootTimer : null;

  const steps: Step[] = INITIAL_STEPS.map((step, index) => {
    let status: Step["status"] = "idle";
    let errorDetails: string | undefined = undefined;

    if (configState.status === "success") {
      status = "success";
    } else if (configState.status === "running") {
      if (index < configState.currentStepIndex) {
        status = "success";
      } else if (index === configState.currentStepIndex) {
        status = "running";
      } else {
        status = "idle";
      }
    } else if (configState.status === "error") {
      if (index < configState.currentStepIndex) {
        status = "success";
      } else if (index === configState.currentStepIndex) {
        status = "error";
        errorDetails = configState.errorDetails;
      } else {
        status = "idle";
      }
    }

    return {
      ...step,
      status,
      errorDetails,
    };
  });

  return (
    <View style={$container}>
      <Stack.Screen
        options={{
          title: "Configure Speaker",
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        contentContainerStyle={$content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header summary */}
        <Card style={$headerCard}>
          <SymbolView
            name={{
              ios: "gearshape.2.fill",
              android: "settings",
              web: "settings",
            }}
            tintColor={COLORS.primary}
            size={36}
          />
          <Text style={$headerTitle}>Pairing with Marge API</Text>
          <Text style={$headerSubtitle}>
            {speaker.name} · {speaker.host}
          </Text>
        </Card>

        {/* Steps Tracker */}
        <Text style={$sectionLabel}>Progress Checklist</Text>
        <Card>
          {steps.map((step, index) => {
            const isPending = step.status === "idle";
            const isActive = step.status === "running";
            const isCompleted = step.status === "success";
            const isFailed = step.status === "error";

            return (
              <View key={step.id}>
                {index > 0 && <View style={$stepDivider} />}
                <View style={$stepRow}>
                  <View style={$stepIconCol}>
                    {isPending && <View style={$dotOutline} />}
                    {isActive && (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    )}
                    {isCompleted && (
                      <SymbolView
                        name={{
                          ios: "checkmark.circle.fill",
                          android: "check",
                          web: "check",
                        }}
                        tintColor={COLORS.success}
                        size={20}
                      />
                    )}
                    {isFailed && (
                      <SymbolView
                        name={{
                          ios: "exclamationmark.triangle.fill",
                          android: "warning",
                          web: "warning",
                        }}
                        tintColor={COLORS.error}
                        size={20}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        $stepLabel,
                        isCompleted && $stepLabelCompleted,
                        isFailed && $stepLabelFailed,
                        isActive && $stepLabelActive,
                      ]}
                    >
                      {step.label}
                      {step.id === "wait_online" && rebootTimer !== null && (
                        <Text style={{ fontWeight: "700" }}>
                          {" "}
                          ({rebootTimer}s)
                        </Text>
                      )}
                    </Text>
                    {step.errorDetails && (
                      <Text style={$stepErrorText}>{step.errorDetails}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </Card>

        {/* Console Log */}
        <Text style={$sectionLabel}>Execution Logs</Text>
        <View style={$consoleCard}>
          <ScrollView
            ref={logsEndRef}
            style={$consoleScroll}
            contentContainerStyle={{ gap: 4 }}
            nestedScrollEnabled
          >
            {logs.length === 0 ? (
              <Text style={$logTextMuted}>Initializing steps...</Text>
            ) : (
              logs.map((log) => {
                let color = "#a1a1aa";
                if (log.type === "success") {
                  color = COLORS.success;
                } else if (log.type === "error") {
                  color = COLORS.error;
                } else if (log.type === "debug") {
                  color = "#71717a";
                }
                return (
                  <Text key={log.id} style={[$logLineText, { color }]}>
                    <Text style={$logTime}>{log.timestamp}</Text> - {log.text}
                  </Text>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Actions */}
        <View style={{ marginTop: 12, gap: 10 }}>
          {isFinished && (
            <TouchableOpacity
              style={$primaryButton}
              onPress={() => {
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Text style={$primaryButtonText}>Done</Text>
            </TouchableOpacity>
          )}

          {hasErrors && (
            <>
              <TouchableOpacity
                style={$primaryButton}
                onPress={() => void runConfiguration()}
                activeOpacity={0.8}
              >
                <Text style={$primaryButtonText}>Retry Configuration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={$secondaryButton}
                onPress={() => {
                  router.back();
                }}
                activeOpacity={0.8}
              >
                <Text style={$secondaryButtonText}>Go Back</Text>
              </TouchableOpacity>
            </>
          )}

          {isRunning && !isFinished && (
            <View style={$runningBanner}>
              <ActivityIndicator size="small" color={COLORS.textMuted} />
              <Text style={$runningBannerText}>
                Configuring speaker, please keep the app open...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $content: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 40,
  gap: 12,
};

const $centerState: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
};

const $notFoundText: TextStyle = {
  fontSize: 16,
  color: COLORS.textMuted,
  marginBottom: 16,
};

const $backButton: ViewStyle = {
  paddingHorizontal: 24,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: COLORS.border,
};

const $backButtonText: TextStyle = {
  fontSize: 14,
  color: COLORS.textSecondary,
  fontWeight: "600",
};

const $headerCard: ViewStyle = {
  alignItems: "center",
  paddingVertical: 24,
  paddingHorizontal: 16,
};

const $headerTitle: TextStyle = {
  fontSize: 20,
  fontWeight: "bold",
  color: COLORS.text,
  marginTop: 12,
  marginBottom: 4,
  textAlign: "center",
};

const $headerSubtitle: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
  textAlign: "center",
};

const $sectionLabel: TextStyle = {
  fontSize: 14,
  fontWeight: "700",
  color: COLORS.primary,
  marginTop: 14,
  marginBottom: 2,
  marginLeft: 4,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const $stepRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 12,
  paddingVertical: 6,
};

const $stepIconCol: ViewStyle = {
  width: 24,
  height: 24,
  alignItems: "center",
  justifyContent: "center",
};

const $dotOutline: ViewStyle = {
  width: 8,
  height: 8,
  borderRadius: 4,
  borderWidth: 1.5,
  borderColor: COLORS.textDisabled,
};

const $stepLabel: TextStyle = {
  fontSize: 14,
  color: COLORS.textSecondary,
  fontWeight: "500",
};

const $stepLabelCompleted: TextStyle = {
  color: COLORS.text,
  fontWeight: "600",
};

const $stepLabelActive: TextStyle = {
  color: COLORS.primary,
  fontWeight: "600",
};

const $stepLabelFailed: TextStyle = {
  color: COLORS.error,
  fontWeight: "600",
};

const $stepErrorText: TextStyle = {
  fontSize: 12,
  color: COLORS.error,
  marginTop: 4,
  lineHeight: 16,
};

const $stepDivider: ViewStyle = {
  height: 1,
  backgroundColor: COLORS.border,
  marginVertical: 8,
};

const $consoleCard: ViewStyle = {
  backgroundColor: "#09090b",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#27272a",
  padding: 12,
};

const $consoleScroll: ViewStyle = {
  height: 160,
};

const $logTextMuted: TextStyle = {
  fontFamily: "monospace",
  fontSize: 11,
  color: "#52525b",
};

const $logLineText: TextStyle = {
  fontFamily: "monospace",
  fontSize: 11,
  lineHeight: 15,
};

const $logTime: TextStyle = {
  color: "#52525b",
};

const $primaryButton: ViewStyle = {
  backgroundColor: COLORS.text,
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
};

const $primaryButtonText: TextStyle = {
  color: COLORS.background,
  fontSize: 15,
  fontWeight: "700",
};

const $secondaryButton: ViewStyle = {
  backgroundColor: COLORS.border,
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
};

const $secondaryButtonText: TextStyle = {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "700",
};

const $runningBanner: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingVertical: 10,
};

const $runningBannerText: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  fontWeight: "500",
};
