import { type ComponentRef, type ReactNode, type Ref, useState } from "react";
import {
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { color, radius, space, type } from "@/ui/tokens";

import { Icon, type IconName } from "./Icon";

export interface TextFieldProps extends TextInputProps {
  /** Leading icon, in `textSecondary`. */
  icon?: IconName;
  /** Trailing content, typically an `IconButton` (e.g. show password). */
  trailing?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Single-line input on the first surface step; focus lifts it one step. */
export function TextField({
  icon,
  trailing,
  ref,
  onFocus,
  onBlur,
  style,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[$field, focused && $focused]}>
      {icon !== undefined && <Icon name={icon} />}
      <TextInput
        {...props}
        ref={ref}
        style={[$input, style]}
        placeholderTextColor={color.textTertiary}
        selectionColor={color.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      {trailing}
    </View>
  );
}

const $field: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  minHeight: 52,
  paddingLeft: space.md,
  paddingRight: space.xxs,
  borderRadius: radius.md,
  backgroundColor: color.surface1,
};

const $focused: ViewStyle = {
  backgroundColor: color.surface2,
};

const $input: TextStyle = {
  ...type.body,
  flex: 1,
  color: color.textPrimary,
  paddingVertical: space.sm,
};
