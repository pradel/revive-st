import { Image, type ImageStyle } from "expo-image";
import { View, type ViewStyle } from "react-native";

import { Text } from "@/ui/ds/Text";
import { color, type ColorName, space } from "@/ui/tokens";

export interface SpeakerStatus {
  label: string;
  tone: "ok" | "warning" | "danger" | "neutral";
}

const toneColor: Record<SpeakerStatus["tone"], ColorName> = {
  ok: "accent",
  warning: "warning",
  danger: "danger",
  neutral: "textSecondary",
};

/**
 * Top of a speaker's settings: its model drawing, name, model and address,
 * and one status line (reachable, internet radio set up).
 */
export function SpeakerSettingsHeader({
  name,
  model,
  host,
  drawing,
  status,
}: {
  name: string;
  model: string;
  host: string;
  drawing: number | undefined;
  status: SpeakerStatus;
}) {
  const statusColor = toneColor[status.tone];
  return (
    <View style={$root}>
      {drawing !== undefined ? (
        <Image
          source={drawing}
          style={$drawing}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text variant="title" numberOfLines={1} accessibilityRole="header">
        {name}
      </Text>
      <Text variant="subhead" color="textSecondary" numberOfLines={1}>
        {`${model} · ${host}`}
      </Text>
      <View style={$status}>
        <View style={[$dot, { backgroundColor: color[statusColor] }]} />
        <Text variant="subhead" color={statusColor}>
          {status.label}
        </Text>
      </View>
    </View>
  );
}

const $root: ViewStyle = {
  width: "100%",
  alignItems: "center",
  gap: space.xxs,
  paddingVertical: space.md,
};

const $drawing: ImageStyle = {
  width: 140,
  height: 88,
  marginBottom: space.sm,
};

const $status: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
  marginTop: space.xs,
};

const $dot: ViewStyle = {
  width: 8,
  height: 8,
  borderRadius: 4,
};
