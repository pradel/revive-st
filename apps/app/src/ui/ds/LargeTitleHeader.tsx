import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";

import { space } from "@/ui/tokens";

import { Text } from "./Text";

export interface LargeTitleHeaderProps {
  title: string;
  /** Trailing actions, typically `IconButton`s. */
  actions?: ReactNode;
}

export function LargeTitleHeader({ title, actions }: LargeTitleHeaderProps) {
  return (
    <View style={$header}>
      <Text variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {actions ? <View style={$actions}>{actions}</View> : null}
    </View>
  );
}

const $header: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: space.screen,
  paddingTop: space.xs,
  paddingBottom: space.sm,
};

const $actions: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xxs,
};
