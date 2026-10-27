import type { ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";

import { space } from "@/ui/tokens";

import { SectionHeader, type SectionHeaderProps } from "./SectionHeader";

export interface ShelfProps {
  title: string;
  action?: SectionHeaderProps["action"];
  children: ReactNode;
}

export function Shelf({ title, action, children }: ShelfProps) {
  return (
    <View>
      <SectionHeader title={title} action={action} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={$content}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const $content: ViewStyle = {
  gap: space.sm,
  paddingHorizontal: space.screen,
};
