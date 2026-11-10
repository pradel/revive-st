import type { ExpoConfig, ConfigContext } from "expo/config";
import {
  withAndroidManifest,
  withAppBuildGradle,
  type ConfigPlugin,
} from "expo/config-plugins";

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

const COMPRESSED_PACKAGING_MARKER = "// Revive ST: compressed APK packaging";

/**
 * Stores the native libraries and the code compressed in the APK, which an
 * Android 11+ build otherwise stores uncompressed so the phone can map them
 * straight from the file. The GitHub APK (build profile `apk`) is downloaded
 * as is, so this makes it about 21 MB smaller; phones then extract the files
 * at install. Google Play compresses its downloads itself, so the store
 * build keeps the default.
 */
const withCompressedApkPackaging: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(COMPRESSED_PACKAGING_MARKER)) {
      mod.modResults.contents += `
${COMPRESSED_PACKAGING_MARKER}
android {
    packagingOptions {
        jniLibs { useLegacyPackaging true }
        dex { useLegacyPackaging true }
    }
}
`;
    }
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const appConfig = withoutLocationServices({
    ...config,
    name: "Revive ST",
    slug: "revive-st",
    owner: "incognito-labs",
    version: pkg.version,
    plugins: [...(config.plugins ?? []), ...crashSymbolsPlugins],
  });
  // EAS Build sets EAS_BUILD_PROFILE to the profile it builds. The GitHub
  // APK also says so in `extra`, so it looks for its own updates.
  return process.env.EAS_BUILD_PROFILE === "apk"
    ? withCompressedApkPackaging({
        ...appConfig,
        extra: { ...appConfig.extra, distribution: "github" },
      })
    : appConfig;
};
