import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { COLORS } from "@/ui/theme";

export default function ProgressScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);

  const step = state.step;

  useEffect(() => {
    if (state.step === "PROVISIONING_COMPLETE") {
      router.replace("/onboarding/success" as any);
    } else if (state.step === "SELECTING_HOME_NETWORK") {
      router.replace("/onboarding/network-picker" as any);
    }
  }, [state.step, router]);

  useEffect(() => {
    if (step === "SENDING_CREDENTIALS") {
      setElapsed(0);
    }
  }, [step]);

  useEffect(() => {
    const activeSteps = [
      "SENDING_CREDENTIALS",
      "WAITING_FOR_SPEAKER_ON_NETWORK",
      "DISCOVERING_SPEAKER",
    ];
    if (!activeSteps.includes(step)) {
      return;
    }

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [step]);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${minutes}:${remaining < 10 ? "0" : ""}${remaining}`;
  };

  const steps = [
    {
      id: "send",
      title: "Sending credentials",
      description: "Transferring Wi-Fi credentials to speaker",
      getStatus: () => {
        if (step === "SENDING_CREDENTIALS") {
          return "active";
        }
        if (step === "CREDENTIALS_FAILED") {
          return "failed";
        }
        const passedSteps = [
          "WAITING_FOR_SPEAKER_ON_NETWORK",
          "DISCOVERING_SPEAKER",
          "PROVISIONING_COMPLETE",
          "DISCOVERY_TIMEOUT",
        ];
        if (passedSteps.includes(step)) {
          return "completed";
        }
        return "pending";
      },
    },
    {
      id: "wait",
      title: "Connecting to Wi-Fi",
      description: "Speaker is joining home Wi-Fi",
      getStatus: () => {
        if (step === "SENDING_CREDENTIALS" || step === "CREDENTIALS_FAILED") {
          return "pending";
        }
        if (step === "WAITING_FOR_SPEAKER_ON_NETWORK") {
          return "active";
        }
        const passedSteps = [
          "DISCOVERING_SPEAKER",
          "PROVISIONING_COMPLETE",
          "DISCOVERY_TIMEOUT",
        ];
        if (passedSteps.includes(step)) {
          return "completed";
        }
        return "pending";
      },
    },
    {
      id: "discover",
      title: "Discovering speaker",
      description: "Searching for speaker on network",
      getStatus: () => {
        const pendingSteps = [
          "SENDING_CREDENTIALS",
          "CREDENTIALS_FAILED",
          "WAITING_FOR_SPEAKER_ON_NETWORK",
        ];
        if (pendingSteps.includes(step)) {
          return "pending";
        }
        if (step === "DISCOVERING_SPEAKER") {
          return "active";
        }
        if (step === "PROVISIONING_COMPLETE") {
          return "completed";
        }
        if (step === "DISCOVERY_TIMEOUT") {
          return "failed";
        }
        return "pending";
      },
    },
  ];

  const isError = step === "CREDENTIALS_FAILED" || step === "DISCOVERY_TIMEOUT";

  const errorMessage = (() => {
    if (step === "CREDENTIALS_FAILED") {
      return "The speaker did not accept the Wi-Fi credentials. Please double check your password and try again.";
    }
    if (step === "DISCOVERY_TIMEOUT") {
      return "Your speaker connected to Wi-Fi successfully, but we could not discover it on the local network. You can retry discovery or connect to it directly via its IP.";
    }
    return "";
  })();

  const statusIcon = (() => {
    if (isError) {
      return "exclamationmark.triangle";
    }
    switch (step) {
      case "SENDING_CREDENTIALS":
        return "paperplane";
      case "WAITING_FOR_SPEAKER_ON_NETWORK":
        return "network";
      case "DISCOVERING_SPEAKER":
        return "binoculars";
      default:
        return "gearshape";
    }
  })();

  const statusIconAndroid = (() => {
    if (isError) {
      return "warning";
    }
    switch (step) {
      case "SENDING_CREDENTIALS":
        return "send";
      case "WAITING_FOR_SPEAKER_ON_NETWORK":
        return "router";
      case "DISCOVERING_SPEAKER":
        return "search";
      default:
        return "settings";
    }
  })();

  return (
    <View style={$container}>
      <Stack.Screen
        options={{
          title: "Setup Speaker",
          headerShown: false,
        }}
      />

      <View style={$content}>
        {/* Visual Header/Icon */}
        <View style={$iconContainer}>
          <SymbolView
            name={{
              ios: statusIcon,
              android: statusIconAndroid,
              web: statusIconAndroid,
            }}
            tintColor={isError ? COLORS.error : COLORS.primary}
            size={48}
          />
        </View>

        {/* Card */}
        <View style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>SETUP WIZARD</Text>
          </View>

          {!isError && (
            <>
              <Text style={$cardTitle}>Setting Up Speaker</Text>

              <View style={$stepsContainer}>
                {steps.map((s, idx) => {
                  const status = s.getStatus();
                  return (
                    <View key={s.id} style={$stepRow}>
                      <View style={$stepIconCol}>
                        {status === "active" ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                            style={$stepSpinner}
                          />
                        ) : (
                          <SymbolView
                            name={{
                              ios:
                                status === "completed"
                                  ? "checkmark.circle.fill"
                                  : status === "failed"
                                    ? "xmark.circle.fill"
                                    : "circle",
                              android:
                                status === "completed"
                                  ? "check_circle"
                                  : status === "failed"
                                    ? "cancel"
                                    : "radio_button_unchecked",
                              web:
                                status === "completed"
                                  ? "check_circle"
                                  : status === "failed"
                                    ? "cancel"
                                    : "radio_button_unchecked",
                            }}
                            tintColor={
                              status === "completed"
                                ? COLORS.primary
                                : status === "failed"
                                  ? COLORS.error
                                  : COLORS.textMuted
                            }
                            size={20}
                          />
                        )}
                        {idx < steps.length - 1 && (
                          <View
                            style={[
                              $stepLine,
                              status === "completed" && $stepLineCompleted,
                            ]}
                          />
                        )}
                      </View>
                      <View style={$stepTextCol}>
                        <Text
                          style={[
                            $stepTitle,
                            status === "active" && $stepTitleActive,
                            status === "completed" && $stepTitleCompleted,
                            status === "failed" && $stepTitleFailed,
                          ]}
                        >
                          {s.title}
                        </Text>
                        <Text style={$stepDescription}>{s.description}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={$timerContainer}>
                <Text style={$timerNote}>
                  This process can take a few minutes as the speaker reboots and
                  connects to your router.
                </Text>
                <Text style={$timerText}>
                  Elapsed Time: {formatTime(elapsed)}
                </Text>
              </View>
            </>
          )}

          {isError && (
            <>
              <Text style={[$cardTitle, { color: COLORS.error }]}>
                Setup Unsuccessful
              </Text>
              <Text style={$cardDescription}>{errorMessage}</Text>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={$buttonContainer}>
          {isError && (
            <TouchableOpacity
              style={$primaryButton}
              onPress={() => {
                dispatch({ type: "RETRY" });
              }}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "arrow.clockwise",
                  android: "refresh",
                  web: "refresh",
                }}
                tintColor={COLORS.background}
                size={18}
              />
              <Text style={$primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
};

const $content: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 24,
  paddingTop: 40,
};

const $iconContainer: ViewStyle = {
  width: 96,
  height: 96,
  borderRadius: 48,
  backgroundColor: COLORS.primaryTransparent,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 32,
  borderWidth: 1,
  borderColor: COLORS.primary,
};

const $card: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: 20,
  padding: 24,
  borderWidth: 1,
  borderColor: COLORS.border,
  width: "100%",
  alignItems: "center",
  marginBottom: 32,
};

const $badge: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: COLORS.primary,
  marginBottom: 16,
};

const $badgeText: TextStyle = {
  fontSize: 10,
  fontWeight: "800",
  color: COLORS.primary,
  letterSpacing: 0.8,
};

const $cardTitle: TextStyle = {
  fontSize: 22,
  fontWeight: "700",
  color: COLORS.text,
  letterSpacing: -0.3,
  marginBottom: 10,
  textAlign: "center",
};

const $cardDescription: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 20,
};

const $buttonContainer: ViewStyle = {
  width: "100%",
  gap: 12,
};

const $primaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: COLORS.primary,
  height: 52,
  borderRadius: 16,
  width: "100%",
};

const $primaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.background,
  fontWeight: "600",
};

const $stepsContainer: ViewStyle = {
  width: "100%",
  marginVertical: 16,
  paddingHorizontal: 8,
  gap: 16,
};

const $stepRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  width: "100%",
};

const $stepIconCol: ViewStyle = {
  alignItems: "center",
  width: 20,
  position: "relative",
  marginRight: 16,
  height: "100%",
};

const $stepLine: ViewStyle = {
  position: "absolute",
  top: 24,
  left: 9,
  width: 2,
  height: 24,
  backgroundColor: COLORS.border,
};

const $stepLineCompleted: ViewStyle = {
  backgroundColor: COLORS.primary,
};

const $stepSpinner: ViewStyle = {
  height: 20,
  width: 20,
};

const $stepTextCol: ViewStyle = {
  flex: 1,
};

const $stepTitle: TextStyle = {
  fontSize: 16,
  fontWeight: "600",
  color: COLORS.textMuted,
  marginBottom: 2,
};

const $stepTitleActive: TextStyle = {
  color: COLORS.text,
};

const $stepTitleCompleted: TextStyle = {
  color: COLORS.primary,
};

const $stepTitleFailed: TextStyle = {
  color: COLORS.error,
};

const $stepDescription: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
  lineHeight: 18,
};

const $timerContainer: ViewStyle = {
  marginTop: 20,
  alignItems: "center",
  width: "100%",
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
  paddingTop: 16,
};

const $timerNote: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 16,
  marginBottom: 8,
};

const $timerText: TextStyle = {
  fontSize: 14,
  fontWeight: "600",
  color: COLORS.primary,
};
