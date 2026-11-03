import type { ExpoConfig, ConfigContext } from "expo/config";
import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

import pkg from "./package.json";

// PostHog's config plugin uploads source maps and native debug symbols from
// every build, which fails without a PostHog key. So it's only added where
// the key is set: the EAS preview and production environments, and not the
// builds contributors make.
const crashSymbolsPlugins: NonNullable<ExpoConfig["plugins"]> = process.env
  .POSTHOG_CLI_API_KEY
  ? [["posthog-react-native/expo", { uploadNativeSymbols: true }]]
  : [];

/**
 * expo-location's library manifest declares two location foreground services,
 * for background location the app never uses (it only reads location to scan
 * for Wi-Fi during setup). Removed so the Play Store doesn't ask for a
 * foreground service declaration.
 */
const withoutLocationServices: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const application = manifest.application?.[0];
    if (application) {
      application.service = [
        ...(application.service ?? []),
        ...[
          "expo.modules.location.services.LocationTaskService",
          "expo.modules.location.next.locationForegroundService.LocationForegroundService",
        ].map((name) => ({
          // oxlint-disable-next-line eslint/id-length -- xml2js's attributes key
          $: { "android:name": name, "tools:node": "remove" },
        })),
      ];
    }
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withoutLocationServices({
    ...config,
    name: "Revive ST",
    slug: "revive-st",
    owner: "incognito-labs",
    version: pkg.version,
    plugins: [...(config.plugins ?? []), ...crashSymbolsPlugins],
  });
