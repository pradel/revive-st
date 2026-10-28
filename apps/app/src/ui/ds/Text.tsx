import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { color, type, type ColorName, type TypeVariant } from "@/ui/tokens";

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: ColorName;
}

export function Text({
  variant = "body",
  color: colorName = "textPrimary",
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      {...props}
      style={[type[variant], { color: color[colorName] }, style]}
    />
  );
}
