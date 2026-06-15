import { Stack } from "expo-router";
import { useEffect } from "react";

import {
  ProvisioningProvider,
  useProvisioning,
} from "@/features/onboarding/ProvisioningContext";
import { COLORS } from "@/ui/theme";

function OnboardingNavigator() {
  const { start } = useProvisioning();

  useEffect(() => {
    start();
  }, [start]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="permissions" />
      <Stack.Screen name="wifi-enable" />
      <Stack.Screen name="scanning" />
      <Stack.Screen name="connecting" />
      <Stack.Screen name="network-picker" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="success" />
    </Stack>
  );
}

export default function OnboardingLayout() {
  return (
    <ProvisioningProvider>
      <OnboardingNavigator />
    </ProvisioningProvider>
  );
}
