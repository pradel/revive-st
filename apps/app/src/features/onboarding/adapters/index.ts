import type { SetupDeps } from "../session/ports";

/**
 * iOS apps cannot scan for Wi-Fi networks, so setup is not offered there, and
 * its native modules (expo-location, react-native-wifi-reborn) aren't linked
 * on iOS (`expo.autolinking.ios.exclude` in package.json): importing them
 * would fail. `index.android.ts` has the real adapters.
 */
export function createSetupDeps(): SetupDeps {
  throw new Error("Speaker setup is only available on Android");
}
