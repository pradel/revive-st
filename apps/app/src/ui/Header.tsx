import { SymbolView } from "expo-symbols";
import React from "react";
import { View, Text, type TextStyle, type ViewStyle } from "react-native";

import { COLORS } from "@/ui/theme";

export function Header() {
  return (
    <View style={$header}>
      <SymbolView
        name={{
          ios: "speaker.wave.2.fill",
          android: "speaker",
          web: "speaker",
        }}
        tintColor={COLORS.primary}
        size={28}
      />
      <Text style={$appTitle}>Revive ST</Text>
    </View>
  );
}

const $header: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 20,
  paddingBottom: 8,
  gap: 12,
};

const $appTitle: TextStyle = {
  fontSize: 28,
  color: COLORS.text,
  fontWeight: "800",
  letterSpacing: -0.5,
};
