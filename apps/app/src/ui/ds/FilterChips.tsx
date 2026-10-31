import { ScrollView, type ViewStyle } from "react-native";

import { space } from "@/ui/tokens";

import { Chip } from "./Chip";
import { isSelected, type FilterChipsProps } from "./FilterChips.types";

export type { FilterChipsProps } from "./FilterChips.types";

/**
 * Horizontally scrolling filter chips. iOS has no native
 * equivalent, so it uses the app's pill chips; `FilterChips.android.tsx`
 * renders Material 3 filter chips.
 */
export function FilterChips<Value extends string>({
  options,
  value,
  onSelect,
  style,
}: FilterChipsProps<Value>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={$content}
    >
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={isSelected(value, option.value)}
          onPress={() => {
            onSelect(option.value);
          }}
        />
      ))}
    </ScrollView>
  );
}

const $content: ViewStyle = {
  gap: space.xs,
  paddingHorizontal: space.screen,
  paddingVertical: space.xs,
};
