import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useWifiProvisioning } from "@/features/onboarding/hooks/useWifiProvisioning";
import { probeSpeakerIP } from "@/features/onboarding/utils/networkHelpers";
import { COLORS } from "@/ui/theme";

export default function ManualIPScreen() {
  const { state, dispatch } = useWifiProvisioning();
  const router = useRouter();
  const [ip, setIP] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (state.step === "PROVISIONING_COMPLETE") {
      router.replace("/onboarding/success" as any);
    } else if (state.step === "SCANNING_FOR_HOTSPOT") {
      router.back();
    }
  }, [state.step, router]);

  const handleValidate = useCallback(async () => {
    setValidating(true);
    setError("");
    try {
      const alive = await probeSpeakerIP(ip);
      if (alive) {
        dispatch({
          type: "MANUAL_IP_VALIDATED",
          ip,
          name: "Speaker",
        });
      } else {
        setError("No SoundTouch device found at this address.");
      }
    } catch {
      setError("Could not connect. Check the IP and try again.");
    }
    setValidating(false);
  }, [ip, dispatch]);

  const handleCancel = useCallback(() => {
    dispatch({ type: "MANUAL_IP_CANCELLED" });
  }, [dispatch]);

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
              ios: "network",
              android: "router",
              web: "router",
            }}
            tintColor={COLORS.primary}
            size={48}
          />
        </View>

        {/* Card */}
        <View style={$card}>
          <View style={$badge}>
            <Text style={$badgeText}>SETUP WIZARD</Text>
          </View>
          <Text style={$cardTitle}>Enter Speaker IP</Text>
          <Text style={$cardDescription}>
            Enter the IP address of your speaker on your home network to connect
            to it directly.
          </Text>

          <TextInput
            style={[$input, inputFocused ? $inputFocused : null]}
            placeholder="192.168.1.x"
            placeholderTextColor={COLORS.textMuted}
            value={ip}
            onChangeText={setIP}
            onFocus={() => {
              setInputFocused(true);
            }}
            onBlur={() => {
              setInputFocused(false);
            }}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? <Text style={$errorText}>{error}</Text> : null}

          {validating && (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={$spinner}
            />
          )}
        </View>

        {/* Action Buttons */}
        {!validating && (
          <View style={$buttonContainer}>
            <TouchableOpacity
              style={[$primaryButton, !ip && $buttonDisabled]}
              onPress={handleValidate}
              disabled={!ip}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "link",
                  android: "link",
                  web: "link",
                }}
                tintColor={COLORS.background}
                size={18}
              />
              <Text style={$primaryButtonText}>Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={$secondaryButton}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              <SymbolView
                name={{
                  ios: "xmark",
                  android: "close",
                  web: "close",
                }}
                tintColor={COLORS.textSecondary}
                size={16}
              />
              <Text style={$secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
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

const $input: TextStyle = {
  backgroundColor: COLORS.background,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  padding: 14,
  fontSize: 18,
  color: COLORS.text,
  width: "100%",
  textAlign: "center",
  marginBottom: 12,
  fontVariant: ["tabular-nums"],
};

const $inputFocused: TextStyle = {
  borderColor: COLORS.primary,
};

const $errorText: TextStyle = {
  fontSize: 14,
  color: COLORS.error,
  textAlign: "center",
  marginTop: 4,
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

const $buttonDisabled: ViewStyle = {
  opacity: 0.5,
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
