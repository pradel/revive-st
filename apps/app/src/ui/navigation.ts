import {
  DarkTheme,
  type NativeStackNavigationOptions,
  type Theme,
} from "expo-router";

import { color } from "./tokens";

/**
 * Navigation theme: native headers, the tab bar and screen transitions draw
 * from the app's dark palette instead of React Navigation's defaults.
 */
export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: color.accent,
    background: color.bg,
    card: color.bg,
    text: color.textPrimary,
    border: color.separator,
  },
};

/**
 * Options shared by every stack: native header with a large title (iOS) that
 * collapses on scroll, and a chevron-only back button. Scrollable content must
 * set `contentInsetAdjustmentBehavior="automatic"` to sit below the header.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  contentStyle: { backgroundColor: color.bg },
  headerLargeTitleEnabled: true,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
};
