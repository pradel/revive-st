import type { ExpoConfig, ConfigContext } from "expo/config";

import pkg from "./package.json";

// PostHog's config plugin uploads source maps and native debug symbols from
// every build, which fails without a PostHog key. So it's only added where
// the key is set: the EAS preview and production environments, and not the
// builds contributors make.
const crashSymbolsPlugins: NonNullable<ExpoConfig["plugins"]> = process.env
  .POSTHOG_CLI_API_KEY
  ? [["posthog-react-native/expo", { uploadNativeSymbols: true }]]
  : [];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Revive ST",
  slug: "revive-st",
  owner: "incognito-labs",
  version: pkg.version,
  plugins: [...(config.plugins ?? []), ...crashSymbolsPlugins],
});
