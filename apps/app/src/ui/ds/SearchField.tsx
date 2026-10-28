import {
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { color, radius, space, type } from "@/ui/tokens";

import { Icon, icons } from "./Icon";
import { IconButton } from "./IconButton";

export interface SearchFieldProps extends Pick<
  TextInputProps,
  "placeholder" | "onSubmitEditing"
> {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
}

export function SearchField({
  value,
  onChangeText,
  onClear,
  placeholder,
  onSubmitEditing,
}: SearchFieldProps) {
  return (
    <View style={$field}>
      <Icon name={icons.search} size={18} />
      <TextInput
        style={$input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={color.textTertiary}
        selectionColor={color.accent}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.trim().length > 0 && (
        <IconButton
          icon={icons.close}
          accessibilityLabel="Clear search"
          onPress={onClear}
          iconSize={14}
        />
      )}
    </View>
  );
}

const $field: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.xs,
  minHeight: 44,
  paddingLeft: space.md,
  paddingRight: space.xxs,
  borderRadius: radius.pill,
  backgroundColor: color.surface1,
};

const $input: TextStyle = {
  ...type.body,
  flex: 1,
  color: color.textPrimary,
  paddingVertical: space.xs,
};
