import type { ExpoConfig, ConfigContext } from "expo/config";

import pkg from "./package.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Revive ST",
  slug: "revive-st",
  owner: "incognito-labs",
  version: pkg.version,
});
