import { Stack } from "expo-router";

import { stackScreenOptions } from "@/ui/navigation";

/**
 * The tab opens on the settings list. Without it, Expo Router seeds the tab's
 * stack with its first route in file order, `server` (before `settings`).
 */
export const unstable_settings = {
  anchor: "settings",
};

export default function SettingsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="server" options={{ title: "Server" }} />
    </Stack>
  );
}
