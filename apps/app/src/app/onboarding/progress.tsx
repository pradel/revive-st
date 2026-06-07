import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useSpeakerDiscovery } from "@/features/onboarding/hooks/useSpeakerDiscovery";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { MDNS_DISCOVERY_TIMEOUT_MS } from "@/features/onboarding/utils/networkHelpers";
import { COLORS } from "@/ui/theme";

export default function ProgressScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "PROVISIONING_COMPLETE") {
      router.replace("/onboarding/success" as any);
    }
  }, [state.step, router]);

  const { start: startDiscovery } = useSpeakerDiscovery({
    timeoutMs: MDNS_DISCOVERY_TIMEOUT_MS,
    onDiscovered: (result) => {
      dispatch({
        type: "SPEAKER_DISCOVERED",
        host: result.host,
        port: result.port,
        name: result.name,
      });
    },
    onTimeout: () => {
      dispatch({ type: "DISCOVERY_TIMEOUT" });
    },
    onError: () => {
      dispatch({ type: "DISCOVERY_TIMEOUT" });
    },
  });

  useEffect(() => {
    if (state.step === "DISCOVERING_SPEAKER") {
      startDiscovery();
    }
  }, [state.step, startDiscovery]);

  const step = state.step;

  const statusText = (() => {
    switch (step) {
      case "SENDING_CREDENTIALS":
        return "Sending Wi-Fi network credentials to your speaker...";
      case "WAITING_FOR_SPEAKER_ON_NETWORK":
        return "Waiting for your speaker to join your home Wi-Fi network...";
      case "DISCOVERING_SPEAKER":
        return "Searching for your speaker on the home network...";
      default:
        return "Setting up speaker...";
    }
  })();

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
              <Text style={$cardDescription}>{statusText}</Text>
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={$spinner}
              />
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

          {step === "DISCOVERY_TIMEOUT" && (
            <TouchableOpacity
              style={$secondaryButton}
              onPress={() => {
                dispatch({ type: "ENTER_MANUAL_IP" });
              }}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "keyboard",
                  android: "keyboard",
                  web: "keyboard",
                }}
                tintColor={COLORS.textSecondary}
                size={18}
              />
              <Text style={$secondaryButtonText}>Enter IP Manually</Text>
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

const $spinner: ViewStyle = {
  marginTop: 16,
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

const $secondaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: COLORS.card,
  height: 52,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  width: "100%",
};

const $secondaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.textSecondary,
  fontWeight: "600",
};
