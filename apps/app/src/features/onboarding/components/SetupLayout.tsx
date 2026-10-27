import { createContext, type ReactNode } from "react";
import {
  Text as RNText,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Icon, type IconName } from "@/ui/ds/Icon";
import { Text } from "@/ui/ds/Text";
import { color, radius, space, type ColorName } from "@/ui/tokens";

/**
 * Lets setup views reveal content hidden behind the keyboard. The scroll view's
 * own scroll-to-focused-input did not move the form's fields above the keyboard
 * on Android 17 (Pixel), so the form scrolls explicitly.
 */
export const SetupScrollContext = createContext<{ scrollToEnd: () => void }>({
  scrollToEnd: () => undefined,
});

interface SetupHeaderProps {
  icon: IconName;
  title: string;
  description?: ReactNode;
  tone?: "default" | "error" | "success";
}

const TONE_COLOR: Record<NonNullable<SetupHeaderProps["tone"]>, ColorName> = {
  default: "textSecondary",
  error: "danger",
  success: "accent",
};

/** Overline, icon, title and description shared by every setup view. */
export function SetupHeader({
  icon,
  title,
  description,
  tone = "default",
}: SetupHeaderProps) {
  return (
    <View style={$header}>
      <Text variant="overline" color="textSecondary" style={$overline}>
        Speaker setup
      </Text>
      <View style={$iconWell}>
        <Icon name={icon} size={40} color={TONE_COLOR[tone]} />
      </View>
      <Text variant="title" accessibilityRole="header" style={$centered}>
        {title}
      </Text>
      {description !== undefined && (
        <Text variant="body" color="textSecondary" style={$centered}>
          {description}
        </Text>
      )}
    </View>
  );
}

/** Highlighted words inside a setup sentence; inherits the sentence's size. */
export function Emphasis({ children }: { children: ReactNode }) {
  return <RNText style={$emphasis}>{children}</RNText>;
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
        <Text variant="caption">{index}</Text>
      </View>
      <Text variant="body" color="textSecondary" style={$flex}>
        {children}
      </Text>
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
  symbol: IconName;
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

export const $setupButtons: ViewStyle = {
  width: "100%",
  gap: space.sm,
  marginTop: space.xs,
};

export const $setupCard: ViewStyle = {
  width: "100%",
  marginBottom: space.lg,
};

/** Bottom spacing of a card's `headline` title. */
export const $setupCardTitle: TextStyle = {
  marginBottom: space.sm,
};

/** Small print under the buttons, as `caption` in `textTertiary`. */
export const $setupNote: TextStyle = {
  textAlign: "center",
};

const $header: ViewStyle = {
  alignItems: "center",
  gap: space.xs,
  marginBottom: space.xl,
};

const $overline: TextStyle = {
  marginBottom: space.sm,
};

const $iconWell: ViewStyle = {
  width: 80,
  height: 80,
  borderRadius: radius.pill,
  backgroundColor: color.surface1,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: space.sm,
};

const $centered: TextStyle = {
  textAlign: "center",
};

const $emphasis: TextStyle = {
  color: color.textPrimary,
  fontWeight: "700",
};

const $instructionRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: space.sm,
  marginBottom: space.sm,
};

const $instructionNumber: ViewStyle = {
  width: 24,
  height: 24,
  borderRadius: radius.pill,
  backgroundColor: color.surface2,
  alignItems: "center",
  justifyContent: "center",
};

const $flex: TextStyle = {
  flex: 1,
};
