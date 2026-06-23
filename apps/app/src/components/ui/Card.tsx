import React from "react";
import {
  View,
  TouchableOpacity,
  type ViewProps,
  type ViewStyle,
  type TouchableOpacityProps,
} from "react-native";

import { COLORS } from "../../ui/theme";

export interface CardProps extends ViewProps {
  children?: React.ReactNode;
  onPress?: TouchableOpacityProps["onPress"];
  activeOpacity?: TouchableOpacityProps["activeOpacity"];
  disabled?: TouchableOpacityProps["disabled"];
}

export function Card({
  children,
  style,
  onPress,
  activeOpacity,
  disabled,
  ...props
}: CardProps) {
  if (onPress || disabled !== undefined) {
    return (
      <TouchableOpacity
        style={[$card, style]}
        onPress={onPress}
        activeOpacity={activeOpacity ?? 0.8}
        disabled={disabled}
        {...(props as any)}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[$card, style]} {...props}>
      {children}
    </View>
  );
}

const $card: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
};
