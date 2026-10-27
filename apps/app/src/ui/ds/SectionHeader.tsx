import { Pressable, View, type ViewStyle } from "react-native";

import { space } from "@/ui/tokens";

import { Text } from "./Text";

export interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={$row}>
      <Text variant="overline" color="textSecondary" accessibilityRole="header">
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            action.onPress();
          }}
          hitSlop={8}
        >
          <Text variant="subhead" color="textSecondary">
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const $row: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: space.screen,
  paddingTop: space.xl,
  paddingBottom: space.xs,
};
