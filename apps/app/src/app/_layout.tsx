import { Stack } from "expo-router";
import { useEffect } from "react";

import { BoseProvider } from "@/features/speakers/contexts/BoseContext";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";
import { COLORS } from "@/ui/theme";

export default function RootLayout() {
  useEffect(() => {
    void initLogger();
  }, []);

  return (
    <QueryProvider>
      <BoseProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen
            name="speakers/[id]/now-playing"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              gestureEnabled: true,
              gestureDirection: "vertical",
            }}
          />
        </Stack>
      </BoseProvider>
    </QueryProvider>
  );
}
