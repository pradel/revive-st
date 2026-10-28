import type { StyleProp, ViewStyle } from "react-native";

export interface FilterChipsProps<Value extends string> {
  options: readonly { value: Value; label: string }[];
  /** The selected option. */
  value: Value;
  /** Called with the tapped option, including the selected one. */
  onSelect: (value: Value) => void;
  /** Outer container, e.g. a negative margin to bleed out of padded lists. */
  style?: StyleProp<ViewStyle>;
}
