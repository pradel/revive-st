import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { createContext, type ReactNode } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { COLORS } from "@/ui/theme";

export type SymbolName = SymbolViewProps["name"];

/**
 * Lets setup views reveal content hidden behind the keyboard. The scroll view's
 * own scroll-to-focused-input did not move the form's fields above the keyboard
 * on Android 17 (Pixel), so the form scrolls explicitly.
 */
export const SetupScrollContext = createContext<{ scrollToEnd: () => void }>({
  scrollToEnd: () => undefined,
});

interface SetupHeaderProps {
  icon: SymbolName;
  title: string;
  description?: ReactNode;
  tone?: "default" | "error" | "success";
}

/** Badge, icon, title and description shared by every setup view. */
export function SetupHeader({
  icon,
  title,
  description,
  tone = "default",
}: SetupHeaderProps) {
  const tint =
    tone === "error"
      ? COLORS.error
      : tone === "success"
        ? COLORS.success
        : COLORS.primary;
  return (
    <View style={$header}>
      <View style={$badge}>
        <Text style={$badgeText}>SPEAKER SETUP</Text>
      </View>
      <View style={$iconCircle}>
        <SymbolView name={icon} tintColor={tint} size={40} />
      </View>
      <Text style={$title}>{title}</Text>
      {description !== undefined && (
        <Text style={$description}>{description}</Text>
      )}
    </View>
  );
}

interface SetupButtonProps {
  label: string;
  onPress: () => void;
  icon?: SymbolName;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
}

export function SetupButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  busy = false,
}: SetupButtonProps) {
  const primary = variant === "primary";
  const tint = primary ? COLORS.background : COLORS.text;
  return (
    <TouchableOpacity
      style={[
        primary ? $primaryButton : $secondaryButton,
        (disabled || busy) && $buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        icon !== undefined && (
          <SymbolView name={icon} tintColor={tint} size={18} />
        )
      )}
      <Text style={primary ? $primaryButtonText : $secondaryButtonText}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** A numbered instruction line. */
export function SetupInstruction({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <View style={$instructionRow}>
      <View style={$instructionNumber}>
        <Text style={$instructionNumberText}>{index}</Text>
      </View>
      <Text style={$instructionText}>{children}</Text>
    </View>
  );
}

const SIGNAL_LEVELS = [
  { minDbm: -55, label: "Strong signal", android: "signal_wifi_4_bar" },
  { minDbm: -67, label: "Good signal", android: "network_wifi_3_bar" },
  { minDbm: -75, label: "Fair signal", android: "network_wifi_2_bar" },
  {
    minDbm: Number.NEGATIVE_INFINITY,
    label: "Weak signal",
    android: "network_wifi_1_bar",
  },
] as const;

/** Symbol and label for a Wi-Fi RSSI in dBm. */
export function signalStrength(level: number): {
  symbol: SymbolName;
  label: string;
} {
  const entry =
    SIGNAL_LEVELS.find((candidate) => level >= candidate.minDbm) ??
    SIGNAL_LEVELS[SIGNAL_LEVELS.length - 1];
  return {
    symbol: { ios: "wifi", android: entry.android, web: entry.android },
    label: entry.label,
  };
}

export const $setupEmphasis: TextStyle = {
  color: COLORS.text,
  fontWeight: "700",
};

export const $setupButtons: ViewStyle = {
  width: "100%",
  gap: 12,
  marginTop: 8,
};

export const $setupCard: ViewStyle = {
  width: "100%",
  marginBottom: 20,
};

export const $setupCardTitle: TextStyle = {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "700",
  marginBottom: 12,
};

export const $setupBody: TextStyle = {
  color: COLORS.textSecondary,
  fontSize: 14,
  lineHeight: 20,
};

export const $setupNote: TextStyle = {
  color: COLORS.textMuted,
  fontSize: 12,
  lineHeight: 16,
  textAlign: "center",
};

const $header: ViewStyle = {
  alignItems: "center",
  marginBottom: 28,
};

const $badge: ViewStyle = {
  backgroundColor: COLORS.primaryTransparent,
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: COLORS.primary,
  marginBottom: 20,
};

const $badgeText: TextStyle = {
  fontSize: 10,
  fontWeight: "800",
  color: COLORS.primary,
  letterSpacing: 0.8,
};

const $iconCircle: ViewStyle = {
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: COLORS.card,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 20,
};

const $title: TextStyle = {
  fontSize: 24,
  fontWeight: "700",
  color: COLORS.text,
  letterSpacing: -0.3,
  marginBottom: 12,
  textAlign: "center",
};

const $description: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
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

const $secondaryButton: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  backgroundColor: COLORS.card,
  borderWidth: 1,
  borderColor: COLORS.border,
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

const $secondaryButtonText: TextStyle = {
  fontSize: 15,
  color: COLORS.text,
  fontWeight: "600",
};

const $instructionRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const $instructionNumber: ViewStyle = {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: COLORS.primaryTransparent,
  alignItems: "center",
  justifyContent: "center",
};

const $instructionNumberText: TextStyle = {
  color: COLORS.primary,
  fontSize: 12,
  fontWeight: "700",
};

const $instructionText: TextStyle = {
  flex: 1,
  color: COLORS.textSecondary,
  fontSize: 14,
  lineHeight: 20,
};
