import { Stack } from "expo-router";

import { COLORS } from "@/ui/theme";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
