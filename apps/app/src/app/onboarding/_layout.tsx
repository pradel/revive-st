import { Stack } from "expo-router";

import { color } from "@/ui/tokens";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
