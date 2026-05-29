import { openWifiSettings } from "expo-bose-wifi";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { logger } from "@/lib/logger";
import { COLORS } from "@/ui/theme";

export default function Permissions() {
  const router = useRouter();

  const handleOpenWifi = () => {
    void (async () => {
      try {
        await openWifiSettings();
      } catch (error) {
        logger.warn(
          `Failed to open Wi-Fi settings: ${error instanceof Error ? error.message : String(error)}`,
        );
        Alert.alert(
          "Wi-Fi Settings",
          "Could not open Wi-Fi settings automatically. Please go to your system settings manually to connect to your speaker's Wi-Fi setup network.",
        );
      }
    })();
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
              ios: "wifi.router.fill",
              android: "router",
              web: "router",
            }}
            tintColor={COLORS.primary}
            size={48}
          />
        </View>

        {/* Coming Soon Card */}
        <View style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>COMING SOON</Text>
          </View>
          <Text style={$cardTitle}>Wi-Fi Setup Wizard</Text>
          <Text style={$cardDescription}>
            We are building an in-app setup guide to connect new or
            factory-reset Bose SoundTouch speakers directly to your network.
          </Text>

          <View style={$divider} />

          <Text style={$instructionHeader}>Temporary Setup Method</Text>
          <Text style={$instructionText}>
            1. Use the official <Text style={$bold}>Bose SoundTouch</Text> app
            to connect your speaker to your Wi-Fi network.{"\n\n"}
            2. Once configured, return to <Text style={$bold}>Revive ST</Text>.
            The speaker will be discovered automatically.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={$buttonContainer}>
          <TouchableOpacity
            style={$primaryButton}
            onPress={handleOpenWifi}
            activeOpacity={0.8}
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
            <Text style={$primaryButtonText}>Open Wi-Fi Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={$secondaryButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            }}
            activeOpacity={0.8}
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

const $divider: ViewStyle = {
  width: "100%",
  height: 1,
  backgroundColor: COLORS.border,
  marginVertical: 16,
};

const $instructionHeader: TextStyle = {
  fontSize: 14,
  fontWeight: "600",
  color: COLORS.text,
  marginBottom: 12,
  alignSelf: "flex-start",
};

const $instructionText: TextStyle = {
  fontSize: 13,
  color: COLORS.textSecondary,
  lineHeight: 20,
  alignSelf: "flex-start",
};

const $bold: TextStyle = {
  fontWeight: "700",
  color: COLORS.text,
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
  backgroundColor: COLORS.text,
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
