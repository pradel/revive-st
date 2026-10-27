import type { ReactNode } from "react";
import { View, type TextStyle, type ViewStyle } from "react-native";

import { color, radius, space } from "@/ui/tokens";

import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  /** Drawn behind the icon, e.g. pulse rings while scanning. */
  iconDecoration?: ReactNode;
  /** Buttons, stacked vertically. */
  actions?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  iconDecoration,
  actions,
}: EmptyStateProps) {
  return (
    <View style={$root}>
      <View style={$iconWell}>
        {iconDecoration}
        <Icon name={icon} size={36} color="textSecondary" />
      </View>
      <Text variant="title" style={$centered}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textSecondary" style={$centered}>
          {description}
        </Text>
      ) : null}
      {actions ? <View style={$actions}>{actions}</View> : null}
    </View>
  );
}

const $root: ViewStyle = {
  alignItems: "center",
  paddingHorizontal: space.xxl,
  paddingVertical: space.xxxl,
  gap: space.xs,
};

const $iconWell: ViewStyle = {
  width: 88,
  height: 88,
  marginBottom: space.md,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.pill,
  backgroundColor: color.surface1,
};

const $centered: TextStyle = { textAlign: "center" };

const $actions: ViewStyle = {
  alignSelf: "stretch",
  gap: space.xs,
  marginTop: space.lg,
};
