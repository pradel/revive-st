import { BottomSheetModalProvider } from "@expo/ui/community/bottom-sheet";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { BoseProvider } from "@/features/speakers/contexts/BoseContext";
import { initLogger } from "@/lib/logger";
import { QueryProvider } from "@/providers/QueryProvider";
import { COLORS } from "@/ui/theme";

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
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.background },
                }}
              >
                <Stack.Screen
                  name="speakers/[id]/now-playing"
                  options={{
                    presentation: "formSheet",
                    sheetGrabberVisible: true,
                  }}
                />
              </Stack>
            </BottomSheetModalProvider>
          </BoseProvider>
        </QueryProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
