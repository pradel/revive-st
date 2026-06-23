import { openWifiSettings } from "expo-bose-wifi";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { COLORS } from "@/ui/theme";

export default function ConnectingScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "CONNECTED_TO_HOTSPOT") {
      router.replace("/onboarding/network-picker" as any);
    }
  }, [state.step, router]);

  const isFailed = state.step === "CONNECTION_FAILED";

  const handleManualRetry = useCallback(() => {
    dispatch({ type: "START_MANUAL_CONNECT" });
  }, [dispatch]);

  const handleOpenWifiSettings = useCallback(() => {
    void openWifiSettings();
  }, []);

  const isManualConnecting = state.step === "MANUAL_CONNECTING";
  const statusText = isManualConnecting
    ? "Looking for speaker on the network..."
    : "Connecting to your speaker...";

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
              ios: isFailed ? "wifi.exclamationmark" : "wifi",
              android: isFailed ? "wifi_off" : "wifi",
              web: isFailed ? "wifi_off" : "wifi",
            }}
            tintColor={isFailed ? COLORS.error : COLORS.primary}
            size={48}
          />
        </View>

        {/* Card */}
        <Card style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>SETUP WIZARD</Text>
          </View>

          {!isFailed && (
            <>
              <Text style={$cardTitle}>Establishing Connection</Text>
              <Text style={$cardDescription}>{statusText}</Text>
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={$spinner}
              />
            </>
          )}

          {isFailed && (
            <>
              <Text style={[$cardTitle, { color: COLORS.error }]}>
                Connection Failed
              </Text>
              <Text style={$cardDescription}>
                We couldn't connect to the speaker automatically.
              </Text>

              {Platform.OS === "android" && (
                <View style={$staticIpBox}>
                  <Text style={$staticIpTitle}>Manual Setup Fallback</Text>
                  <Text style={$staticIpStep}>
                    1. Tap the button below to open Wi-Fi settings.
                  </Text>
                  <TouchableOpacity
                    style={$settingsButton}
                    onPress={handleOpenWifiSettings}
                    activeOpacity={0.8}
                  >
                    <Text style={$settingsButtonText}>Open Wi-Fi Settings</Text>
                  </TouchableOpacity>
                  <Text style={$staticIpStep}>
                    2. Connect to the speaker's hotspot and configure a static
                    IP:
                  </Text>
                  <View style={$ipList}>
                    <View style={$ipRow}>
                      <Text style={$ipLabel}>IP:</Text>
                      <Text style={$ipValue}>192.0.2.50</Text>
                    </View>
                    <View style={$ipRow}>
                      <Text style={$ipLabel}>Gateway:</Text>
                      <Text style={$ipValue}>192.0.2.1</Text>
                    </View>
                    <View style={$ipRow}>
                      <Text style={$ipLabel}>Prefix:</Text>
                      <Text style={$ipValue}>24</Text>
                    </View>
                    <View style={$ipRow}>
                      <Text style={$ipLabel}>DNS:</Text>
                      <Text style={$ipValue}>192.0.2.1</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </Card>

        {/* Action Buttons */}
        <View style={$buttonContainer}>
          {isFailed && Platform.OS === "android" && (
            <TouchableOpacity
              style={$primaryButton}
              onPress={handleManualRetry}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "play.fill",
                  android: "play_arrow",
                  web: "play_arrow",
                }}
                tintColor={COLORS.background}
                size={16}
              />
              <Text style={$primaryButtonText}>Continue Setup</Text>
            </TouchableOpacity>
          )}

          {isFailed && Platform.OS !== "android" && (
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
  borderRadius: 20,
  padding: 24,
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
  marginBottom: 12,
};

const $staticIpBox: ViewStyle = {
  backgroundColor: COLORS.background,
  borderRadius: 12,
  padding: 16,
  width: "100%",
  borderWidth: 1,
  borderColor: COLORS.border,
  gap: 12,
  marginTop: 8,
};

const $staticIpTitle: TextStyle = {
  fontSize: 15,
  fontWeight: "600",
  color: COLORS.text,
  textAlign: "center",
};

const $staticIpStep: TextStyle = {
  fontSize: 13,
  color: COLORS.textSecondary,
  lineHeight: 18,
};

const $ipList: ViewStyle = {
  gap: 6,
  paddingHorizontal: 8,
};

const $ipRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const $ipLabel: TextStyle = {
  fontSize: 14,
  fontWeight: "600",
  color: COLORS.textMuted,
  width: 70,
  textAlign: "right",
};

const $ipValue: TextStyle = {
  fontSize: 14,
  color: COLORS.primary,
  fontWeight: "600",
  width: 110,
  fontVariant: ["tabular-nums"],
};

const $settingsButton: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: COLORS.primary,
  borderRadius: 12,
  backgroundColor: COLORS.primaryTransparent,
  alignItems: "center",
  marginVertical: 4,
};

const $settingsButtonText: TextStyle = {
  color: COLORS.primary,
  fontSize: 14,
  fontWeight: "600",
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
