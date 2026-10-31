import type { StyleProp, ViewStyle } from "react-native";

export interface FilterChipsProps<Value extends string> {
  options: readonly { value: Value; label: string }[];
  /** The selected option, or every selected one when several can be. */
  value: Value | readonly Value[];
  /** Called with the tapped option, including the selected one. */
  onSelect: (value: Value) => void;
  /** Outer container, e.g. a negative margin to bleed out of padded lists. */
  style?: StyleProp<ViewStyle>;
}

export const isSelected = <Value extends string>(
  selection: Value | readonly Value[],
  value: Value,
) =>
  typeof selection === "string"
    ? selection === value
    : selection.includes(value);
