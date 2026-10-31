import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { loadServerUrl } from "@/features/server/server";
import {
  BoseProvider,
  useBose,
} from "@/features/speakers/contexts/BoseContext";
import {
  loadLocalNetworkIntro,
  useLocalNetworkIntro,
} from "@/features/speakers/lib/local-network";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";
import { navigationTheme, stackScreenOptions } from "@/ui/navigation";
import { color } from "@/ui/tokens";

// The splash stays up until the first screen has what it shows (see
// `SplashGate`), then fades out, instead of flashing an empty screen.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

/**
 * Hides the splash once the first screen is ready: the Local Network intro
 * (iOS, first launch), or home with the remembered speakers listed.
 */
function SplashGate() {
  const intro = useLocalNetworkIntro();
  const { restored } = useBose();
  const ready = intro === "needed" || (intro === "done" && restored);
  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
    }
  }, [ready]);
  return null;
}

export default function RootLayout() {
  const intro = useLocalNetworkIntro();

  useEffect(() => {
    void initLogger();
    void loadServerUrl();
    void loadLocalNetworkIntro();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryProvider>
          <BoseProvider>
            <SplashGate />
            <ThemeProvider value={navigationTheme}>
              {/* oxlint-disable-next-line react/style-prop-object -- expo-status-bar's `style` is a bar style name */}
              <StatusBar style="light" />
              <Stack screenOptions={stackScreenOptions}>
                <Stack.Protected guard={intro !== "needed"}>
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen name="logs" options={{ title: "Logs" }} />
                  <Stack.Screen
                    name="speakers/[id]/settings"
                    // The header card under it shows the speaker's name large.
                    options={{ headerLargeTitleEnabled: false }}
                  />
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
                </Stack.Protected>
                <Stack.Protected guard={intro === "needed"}>
                  <Stack.Screen
                    name="welcome"
                    options={{ headerShown: false, animation: "fade" }}
                  />
                </Stack.Protected>
              </Stack>
            </ThemeProvider>
          </BoseProvider>
        </QueryProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
