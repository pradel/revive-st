import { ActivityIndicator, Pressable, type ViewStyle } from "react-native";

import { color, radius, space, type ColorName } from "@/ui/tokens";

import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}

const VARIANT_STYLE: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: color.accent },
  secondary: { backgroundColor: color.surface2 },
  ghost: { backgroundColor: "transparent" },
};

const VARIANT_TEXT: Record<ButtonVariant, ColorName> = {
  primary: "onAccent",
  secondary: "textPrimary",
  ghost: "textPrimary",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const inactive = disabled || loading;
  const textColor = VARIANT_TEXT[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        $base,
        VARIANT_STYLE[variant],
        (pressed || inactive) && $dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color[textColor]} />
      ) : (
        icon && <Icon name={icon} size={18} color={textColor} />
      )}
      <Text variant="headline" color={textColor}>
        {label}
      </Text>
    </Pressable>
  );
}

const $base: ViewStyle = {
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: space.xs,
  paddingHorizontal: space.xl,
  borderRadius: radius.pill,
};

const $dimmed: ViewStyle = {
  opacity: 0.6,
};
