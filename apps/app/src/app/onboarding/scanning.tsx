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

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { COLORS } from "@/ui/theme";

export default function ScanningScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();

  useEffect(() => {
    if (state.step === "CONNECTING_TO_HOTSPOT") {
      router.replace("/onboarding/connecting" as any);
    } else if (state.step === "MANUAL_IP_ENTRY") {
      router.push("/onboarding/manual-ip" as any);
    } else if (state.step === "WIFI_DISABLED") {
      router.replace("/onboarding/wifi-enable" as any);
    }
  }, [state.step, router]);

  const isNotFound = state.step === "HOTSPOT_NOT_FOUND";
  const isScanning = state.step === "SCANNING_FOR_HOTSPOT";

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
              ios: isNotFound ? "wifi.exclamationmark" : "wifi",
              android: isNotFound ? "wifi_off" : "wifi",
              web: isNotFound ? "wifi_off" : "wifi",
            }}
            tintColor={isNotFound ? COLORS.error : COLORS.primary}
            size={48}
          />
        </View>

        {/* Card */}
        <View style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>SETUP WIZARD</Text>
          </View>

          {isScanning && (
            <>
              <Text style={$cardTitle}>Searching for Speaker</Text>
              <Text style={$cardDescription}>
                Looking for your Bose SoundTouch speaker's setup network. Make
                sure your speaker's Wi-Fi indicator is pulsing amber.
              </Text>
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={$spinner}
              />
            </>
          )}

          {isNotFound && (
            <>
              <Text style={[$cardTitle, { color: COLORS.error }]}>
                No Speaker Found
              </Text>
              <Text style={$cardDescription}>
                We couldn't detect a Bose speaker in setup mode nearby.
              </Text>
              <View style={$hintBox}>
                <Text style={$hintText}>
                  To put your speaker in setup mode, press and hold the{" "}
                  <Text style={{ fontWeight: "700" }}>2</Text> and{" "}
                  <Text style={{ fontWeight: "700" }}>Volume Down</Text> buttons
                  on the speaker for 5 seconds until the Wi-Fi indicator glows
                  solid amber.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={$buttonContainer}>
          {isNotFound && (
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
              <Text style={$primaryButtonText}>Scan Again</Text>
            </TouchableOpacity>
          )}

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

const $hintBox: ViewStyle = {
  backgroundColor: COLORS.background,
  borderRadius: 12,
  padding: 16,
  width: "100%",
  borderWidth: 1,
  borderColor: COLORS.border,
};

const $hintText: TextStyle = {
  fontSize: 13,
  color: COLORS.textSecondary,
  textAlign: "center",
  lineHeight: 18,
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
