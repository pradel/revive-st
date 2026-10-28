import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { BoseProvider } from "@/features/speakers/contexts/BoseContext";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";
import { navigationTheme, stackScreenOptions } from "@/ui/navigation";
import { color } from "@/ui/tokens";

export default function RootLayout() {
  useEffect(() => {
    void initLogger();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryProvider>
          <BoseProvider>
            <ThemeProvider value={navigationTheme}>
              {/* oxlint-disable-next-line react/style-prop-object -- expo-status-bar's `style` is a bar style name */}
              <StatusBar style="light" />
              <Stack screenOptions={stackScreenOptions}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="onboarding"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="logs" options={{ title: "Logs" }} />
                <Stack.Screen
                  name="speakers/[id]/now-playing"
                  options={{
                    presentation: "formSheet",
                    sheetGrabberVisible: true,
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="cast"
                  options={{
                    presentation: "formSheet",
                    sheetAllowedDetents: "fitToContents",
                    sheetGrabberVisible: true,
                    headerShown: false,
                    contentStyle: { backgroundColor: color.surface1 },
                  }}
                />
              </Stack>
            </ThemeProvider>
          </BoseProvider>
        </QueryProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
