import { Stack } from "expo-router";

import { stackScreenOptions } from "@/ui/navigation";

export default function RadioLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="radio" options={{ title: "Radio" }} />
      <Stack.Screen name="stream-url" options={{ title: "Stream URL" }} />
    </Stack>
  );
}
