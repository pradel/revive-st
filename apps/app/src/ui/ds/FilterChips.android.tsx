import CheckIcon from "@expo/material-symbols/check.xml";
import { FilterChip, Host, Icon, Row, Text } from "@expo/ui/jetpack-compose";
import { horizontalScroll, padding } from "@expo/ui/jetpack-compose/modifiers";
import type { ViewStyle } from "react-native";

import { color, space } from "@/ui/tokens";

import { isSelected, type FilterChipsProps } from "./FilterChips.types";

/** Material 3 filter chips in the app's colors, scrolling horizontally. */
export function FilterChips<Value extends string>({
  options,
  value,
  onSelect,
  style,
}: FilterChipsProps<Value>) {
  return (
    // As a lone list header, a host sized only by its content collapses to
    // zero before Compose measures the chips, so it starts at the chips'
    // standard height and grows when larger text makes them taller.
    <Host matchContents={{ vertical: true }} style={[$row, style]}>
      <Row
        horizontalArrangement={{ spacedBy: space.xs }}
        modifiers={[
          horizontalScroll(),
          padding(space.screen, space.xs, space.screen, space.xs),
        ]}
      >
        {options.map((option) => {
          const selected = isSelected(value, option.value);
          return (
            <FilterChip
              key={option.value}
              selected={selected}
              onClick={() => {
                onSelect(option.value);
              }}
              colors={{
                containerColor: color.surface1,
                labelColor: color.textPrimary,
                selectedContainerColor: color.accent,
                selectedLabelColor: color.onAccent,
                selectedLeadingIconColor: color.onAccent,
              }}
              border={{
                width: 1,
                color: selected ? color.accent : color.surface3,
              }}
            >
              <FilterChip.Label>
                <Text>{option.label}</Text>
              </FilterChip.Label>
              {selected ? (
                <FilterChip.LeadingIcon>
                  <Icon source={CheckIcon} size={18} />
                </FilterChip.LeadingIcon>
              ) : null}
            </FilterChip>
          );
        })}
      </Row>
    </Host>
  );
}

/** Material 3 filter chips are 32dp tall at the default text size. */
const $row: ViewStyle = {
  minHeight: 32 + space.xs * 2,
};
