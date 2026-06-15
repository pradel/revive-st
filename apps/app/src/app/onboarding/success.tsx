import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { SymbolView } from "expo-symbols";
import {
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { COLORS } from "@/ui/theme";

export default function SuccessScreen() {
  const { state } = useWifiProvisioning();
  const router = useRouter();

  const s = state as { speakerName?: string; speakerIP?: string };

  const handleDone = async () => {
    if (s.speakerIP) {
      await SecureStore.setItemAsync("speaker_ip", s.speakerIP);
    }
    if (s.speakerName) {
      await SecureStore.setItemAsync("speaker_name", s.speakerName);
    }
    router.replace("/" as any);
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
              ios: "checkmark.circle.fill",
              android: "check_circle",
              web: "check_circle",
            }}
            tintColor={COLORS.primary}
            size={48}
          />
        </View>

        {/* Card */}
        <View style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>SETUP COMPLETED</Text>
          </View>
          <Text style={$cardTitle}>Speaker is Ready</Text>
          <Text style={$speakerName}>
            {s.speakerName ?? "SoundTouch Speaker"}
          </Text>
          <Text style={$cardDescription}>
            Your speaker has been configured and connected successfully to your
            local network.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={$buttonContainer}>
          <TouchableOpacity
            style={$primaryButton}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <SymbolView
              name={{
                ios: "checkmark",
                android: "check",
                web: "check",
              }}
              tintColor={COLORS.background}
              size={18}
            />
            <Text style={$primaryButtonText}>Got It</Text>
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
  marginBottom: 4,
  textAlign: "center",
};

const $speakerName: TextStyle = {
  fontSize: 18,
  fontWeight: "600",
  color: COLORS.primary,
  marginBottom: 12,
  textAlign: "center",
};

const $cardDescription: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
  marginBottom: 8,
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
