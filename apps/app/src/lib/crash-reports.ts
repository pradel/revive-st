import Constants from "expo-constants";
import PostHog from "posthog-react-native";

import { APP_CONFIG } from "@/config";

import { scrubCrashReport } from "./crash-report-scrub";

// Typed `any` where Expo's generated `expo-env.d.ts` is missing, as in CI.
const apiKey: unknown = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

/**
 * Crash reporting: uncaught JavaScript errors, unhandled rejections and
 * native crashes (Android NDK ones included) go to PostHog, and
 * nothing else: no analytics, screens, feature flags, surveys or replays, no
 * person profiles and no location from the IP. Off in development and in
 * builds made without the PostHog project key, such as contributors'.
 */
const posthog =
  typeof apiKey === "string" && apiKey !== "" && !__DEV__
    ? new PostHog(apiKey, {
        host: APP_CONFIG.POSTHOG_HOST,
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        personProfiles: "never",
        preloadFeatureFlags: false,
        disableRemoteFeatureFlags: true,
        sendFeatureFlagEvent: false,
        setDefaultPersonProperties: false,
        disableSurveys: true,
        disableGeoip: true,
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
            console: false,
            nativeCrashes: true,
            androidNdkCrashes: true,
          },
        },
        before_send: scrubCrashReport,
      })
    : null;

// Release tagging: PostHog links these EAS properties to the project and
// account on expo.dev. The app version and build are already on every report.
// The EAS Update ones (`eas/update_id`, `eas/channel`, `eas/runtime_version`)
// need expo-updates, which the app doesn't use (docs/adr/0005).
const eas: unknown = Constants.expoConfig?.extra?.eas;
void posthog?.register({
  "eas/project_id":
    eas !== null &&
    typeof eas === "object" &&
    "projectId" in eas &&
    typeof eas.projectId === "string"
      ? eas.projectId
      : null,
  "eas/account": Constants.expoConfig?.owner ?? null,
});

/** Reports an error the app caught, such as a screen that failed to render. */
export function reportError(error: unknown): void {
  posthog?.captureException(error);
}
