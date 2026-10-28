import { Pressable, View, type ViewStyle } from "react-native";

import { color, radius, space } from "@/ui/tokens";

import { Text } from "./Text";

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  return (
    <View style={$track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(option.value);
            }}
            style={[$segment, selected && $segmentSelected]}
          >
            <Text
              variant="subhead"
              color={selected ? "textPrimary" : "textSecondary"}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const $track: ViewStyle = {
  flexDirection: "row",
  padding: space.xxs,
  borderRadius: radius.pill,
  backgroundColor: color.surface1,
};

const $segment: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  borderRadius: radius.pill,
};

const $segmentSelected: ViewStyle = {
  backgroundColor: color.surface3,
};
