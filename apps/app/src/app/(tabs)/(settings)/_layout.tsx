import { Stack } from "expo-router";

import { stackScreenOptions } from "@/ui/navigation";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="server" options={{ title: "Server" }} />
    </Stack>
  );
}
