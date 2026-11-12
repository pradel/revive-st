import { Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { loadServerUrl } from "@/features/server/server";
import {
  loadLocalNetworkIntro,
  useLocalNetworkIntro,
} from "@/features/speakers/lib/local-network";
import {
  loadSelectedSpeaker,
  useSelectionLoaded,
} from "@/features/speakers/lib/selection";
import {
  speakerRegistry,
  useSpeakerDiscovery,
  useSpeakers,
} from "@/features/speakers/registry/store";
import { reportError } from "@/lib/crash-reports";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";
import { Button } from "@/ui/ds/Button";
import { EmptyState } from "@/ui/ds/EmptyState";
import { icons } from "@/ui/ds/Icon";
import { Screen } from "@/ui/ds/Screen";
import { navigationTheme, stackScreenOptions } from "@/ui/navigation";
import { color } from "@/ui/tokens";

// The splash stays up until the first screen has what it shows (see
// `SplashGate`), then fades out, instead of flashing an empty screen.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

/**
 * Hides the splash once the first screen is ready: the Local Network intro
 * (iOS, first launch), or home with the remembered speakers listed and the
 * selected one known.
 */
function SplashGate() {
  const intro = useLocalNetworkIntro();
  const { restored } = useSpeakers();
  const selectionLoaded = useSelectionLoaded();
  const ready =
    intro === "needed" || (intro === "done" && restored && selectionLoaded);
  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
    }
  }, [ready]);
  return null;
}

/**
 * Shown instead of a blank app when a screen fails to render: the error is
 * reported, and "Try again" renders the app again.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  useEffect(() => {
    // The error may come before the first screen hid the splash.
    SplashScreen.hide();
  }, []);
  return (
    <Screen presentation="fullscreen">
      <View style={$centered}>
        <EmptyState
          icon={icons.warning}
          title="Something went wrong"
          description="Revive ST ran into a problem showing this screen."
          actions={
            <Button
              label="Try again"
              onPress={() => {
                void retry();
              }}
            />
          }
        />
      </View>
    </Screen>
  );
}

const $centered: ViewStyle = {
  flex: 1,
  justifyContent: "center",
};

export default function RootLayout() {
  const intro = useLocalNetworkIntro();
  // On iOS the first scan triggers the Local Network prompt, so it waits for
  // the screen explaining it.
  useSpeakerDiscovery(intro === "done");

  useEffect(() => {
    void initLogger();
    // The remembered speakers' radio says whether they use our server, so
    // they're listed once it's known.
    void loadServerUrl().then(async () => speakerRegistry.restore());
    void loadLocalNetworkIntro();
    void loadSelectedSpeaker();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryProvider>
          <SplashGate />
          <ThemeProvider value={navigationTheme}>
            {/* oxlint-disable-next-line react/style-prop-object -- expo-status-bar's `style` is a bar style name */}
            <StatusBar style="light" />
            <Stack screenOptions={stackScreenOptions}>
              <Stack.Protected guard={intro !== "needed"}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
                  name="speakers/[id]/configure"
                  // Its setup views show their own large title.
                  options={{ headerLargeTitleEnabled: false }}
                />
                <Stack.Screen
                  name="speakers/[id]/pair"
                  // The header card under it shows the pair's name large.
                  options={{ headerLargeTitleEnabled: false }}
                />
                <Stack.Screen
                  name="speakers/[id]/create-pair"
                  // Its views show their own large title.
                  options={{ headerLargeTitleEnabled: false }}
                />
                <Stack.Screen
                  name="now-playing"
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
                <Stack.Screen
                  name="speaker-picker"
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
        </QueryProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
