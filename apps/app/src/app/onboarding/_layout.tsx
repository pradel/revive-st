import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#09090b" },
      }}
    >
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
