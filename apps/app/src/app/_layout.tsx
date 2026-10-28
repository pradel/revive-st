import { BottomSheetModalProvider } from "@expo/ui/community/bottom-sheet";
import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { BoseProvider } from "@/features/speakers/contexts/BoseContext";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";
import { navigationTheme, stackScreenOptions } from "@/ui/navigation";

export default function RootLayout() {
  useEffect(() => {
    void initLogger();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryProvider>
          <BoseProvider>
            <BottomSheetModalProvider>
              <ThemeProvider value={navigationTheme}>
                {/* oxlint-disable-next-line react/style-prop-object -- expo-status-bar's `style` is a bar style name */}
                <StatusBar style="light" />
                <Stack screenOptions={stackScreenOptions}>
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="speakers/[id]"
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
                </Stack>
              </ThemeProvider>
            </BottomSheetModalProvider>
          </BoseProvider>
        </QueryProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
