import { Stack } from "expo-router";
import { Text, View, type TextStyle, type ViewStyle } from "react-native";

import { COLORS } from "@/ui/theme";

export default function Permissions() {
  return (
    <View style={$container}>
      <Stack.Screen
        options={{
          title: "Setup Speaker",
          headerShown: false,
        }}
      />
      <Text style={$title}>Speaker Setup</Text>
      <Text style={$description}>
        The speaker setup flow will be migrated here in a future update.
      </Text>
    </View>
  );
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: COLORS.background,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 40,
};

const $title: TextStyle = {
  fontSize: 20,
  fontWeight: "700",
  color: COLORS.text,
  marginBottom: 10,
};

const $description: TextStyle = {
  fontSize: 14,
  color: COLORS.textMuted,
  textAlign: "center",
  lineHeight: 20,
};
