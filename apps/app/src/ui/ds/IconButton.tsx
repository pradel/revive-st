import {
  Pressable,
  type PressableStateCallbackType,
  type ViewStyle,
} from "react-native";

import { color, radius, type ColorName } from "@/ui/tokens";

import { Icon, type IconName } from "./Icon";

export type IconButtonVariant = "plain" | "filled" | "accent";

export interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: IconButtonVariant;
  /** Diameter of the button; never below the 40pt hit area. */
  size?: number;
  iconSize?: number;
  /** Overrides the variant's icon color (e.g. `accent` for an active toggle). */
  tint?: ColorName;
  disabled?: boolean;
}

const VARIANT_TINT: Record<IconButtonVariant, ColorName> = {
  plain: "textSecondary",
  filled: "textPrimary",
  accent: "onAccent",
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = "plain",
  size = 40,
  iconSize,
  tint,
  disabled = false,
}: IconButtonProps) {
  const diameter = Math.max(size, 40);
  const shape: ViewStyle = {
    width: diameter,
    height: diameter,
    backgroundColor: backgroundFor(variant, disabled),
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }: PressableStateCallbackType) => [
        $base,
        shape,
        pressed && $pressed,
      ]}
    >
      <Icon
        name={icon}
        size={iconSize ?? Math.round(diameter * 0.5)}
        color={disabled ? "textTertiary" : (tint ?? VARIANT_TINT[variant])}
      />
    </Pressable>
  );
}

function backgroundFor(variant: IconButtonVariant, disabled: boolean) {
  if (variant === "plain") {
    return "transparent";
  }
  if (variant === "accent" && !disabled) {
    return color.accent;
  }
  return color.surface2;
}

const $base: ViewStyle = {
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radius.pill,
};

const $pressed: ViewStyle = {
  opacity: 0.6,
};
