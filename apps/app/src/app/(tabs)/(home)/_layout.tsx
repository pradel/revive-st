import { Stack } from "expo-router";

import { stackScreenOptions } from "@/ui/navigation";

export default function HomeLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Speakers" }} />
    </Stack>
  );
}
