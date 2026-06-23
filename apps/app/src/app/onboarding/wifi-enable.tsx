import { openWifiSettingsPanel } from "expo-bose-wifi";
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

import { Card } from "@/components/ui/Card";
import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { logger } from "@/lib/logger";
import { COLORS } from "@/ui/theme";

export default function WifiEnableScreen() {
  const { state, checkWifiStatus } = useWifiProvisioning();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.step === "SCANNING_FOR_HOTSPOT") {
      router.replace("/onboarding/scanning" as any);
    }
  }, [state.step, router]);

  const handleEnableWifi = async () => {
    setLoading(true);
    try {
      await openWifiSettingsPanel();
      // Wait briefly before running a manual check to allow panel startup/interaction
      setTimeout(async () => {
        await checkWifiStatus();
        setLoading(false);
      }, 1000);
    } catch (err) {
      logger.warn(
        "[WifiEnableScreen] Failed to open Wi-Fi settings panel:",
        err,
      );
      setLoading(false);
    }
  };

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
              ios: "wifi",
              android: "wifi",
              web: "wifi",
            }}
            tintColor={COLORS.primary}
            size={48}
          />
        </View>

        {/* Card */}
        <Card style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>SETUP WIZARD</Text>
          </View>
          <Text style={$cardTitle}>Wi-Fi is Disabled</Text>
          <Text style={$cardDescription}>
            To find and connect to your Bose SoundTouch speaker, this app needs
            Wi-Fi to be turned on. This is required to search for and connect to
            the speaker's setup hotspot.
          </Text>

          {loading && (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={$spinner}
            />
          )}
        </Card>

        {/* Action Buttons */}
        <View style={$buttonContainer}>
          <TouchableOpacity
            style={$primaryButton}
            onPress={handleEnableWifi}
            activeOpacity={0.8}
            disabled={loading}
          >
            <SymbolView
              name={{
                ios: "wifi",
                android: "wifi",
                web: "wifi",
              }}
              tintColor={COLORS.background}
              size={18}
            />
            <Text style={$primaryButtonText}>Enable Wi-Fi</Text>
          </TouchableOpacity>

          <Card
            style={$secondaryButton}
            render={
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace("/(tabs)");
                  }
                }}
              />
            }
          >
            <SymbolView
              name={{
                ios: "arrow.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              tintColor={COLORS.textSecondary}
              size={16}
            />
            <Text style={$secondaryButtonText}>Back to Dashboard</Text>
          </Card>
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
  height: 52,
  width: "100%",
};

const $secondaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.textSecondary,
  fontWeight: "600",
};
