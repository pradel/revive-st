import { SegmentedControl as NativeSegmentedControl } from "@expo/ui/community/segmented-control";
import { Platform } from "react-native";

import { haptics } from "@/lib/haptics";
import { color } from "@/ui/tokens";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/**
 * Native segmented control (UISegmentedControl on iOS, Material 3 segmented
 * buttons on Android) with typed values. Android's selected segment uses the
 * accent tint instead of the wallpaper-derived Material color.
 */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  return (
    <NativeSegmentedControl
      values={options.map((option) => option.label)}
      selectedIndex={options.findIndex((option) => option.value === value)}
      appearance="dark"
      tintColor={Platform.OS === "android" ? color.accentMuted : undefined}
      onChange={(event) => {
        const option = options[event.nativeEvent.selectedSegmentIndex];
        if (option !== undefined && option.value !== value) {
          haptics.selection();
          onChange(option.value);
        }
      }}
    />
  );
}
