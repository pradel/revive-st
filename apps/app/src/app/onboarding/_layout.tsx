import { useEffect } from "react";
import { Stack } from "expo-router";
import { ProvisioningProvider, useProvisioning } from "@/features/onboarding/ProvisioningContext";

function OnboardingNavigator() {
  const { start } = useProvisioning();

  useEffect(() => {
    start();
  }, [start]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="permissions" />
      <Stack.Screen name="scanning" />
      <Stack.Screen name="connecting" />
      <Stack.Screen name="network-picker" />
      <Stack.Screen name="progress" />
      <Stack.Screen name="success" />
      <Stack.Screen name="manual-ip" options={{ presentation: "modal" }} />
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
