import { SymbolView } from "expo-symbols";
import React from "react";
import { View, Text, type TextStyle, type ViewStyle } from "react-native";

import { COLORS } from "@/ui/theme";

export interface PageHeaderProps {
  title: string;
  rightComponent?: React.ReactNode;
  hideIcon?: boolean;
}

export function PageHeader({
  title,
  rightComponent,
  hideIcon,
}: PageHeaderProps) {
  return (
    <View style={$header}>
      <View style={$leftContent}>
        {!hideIcon && (
          <SymbolView
            name={{
              ios: "speaker.wave.2.fill",
              android: "speaker",
              web: "speaker",
            }}
            tintColor={COLORS.primary}
            size={28}
          />
        )}
        <Text style={$appTitle}>{title}</Text>
      </View>
      {rightComponent}
    </View>
  );
}

const $header: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 20,
  paddingTop: 8,
  paddingBottom: 16,
};

const $leftContent: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

const $appTitle: TextStyle = {
  fontSize: 28,
  color: COLORS.text,
  fontWeight: "800",
  letterSpacing: -0.5,
};
