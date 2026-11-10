import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

import { APP_CONFIG } from "@/config";
import { appVersion } from "@/lib/app-version";

import { newestAppUpdate } from "./releases";

/**
 * Whether this build is the APK attached to GitHub Releases (EAS build profile
 * `apk`, see `app.config.ts`): no store updates it, so it looks for newer
 * releases itself.
 */
export const isGitHubApk =
  Constants.expoConfig?.extra?.distribution === "github";

/**
 * A newer release of the app to install, looked up on GitHub once per launch
 * in the GitHub APK only; none when there isn't one or GitHub can't be reached.
 */
export function useAppUpdate() {
  return useQuery({
    queryKey: ["app-update"],
    queryFn: async ({ signal }) => {
      const response = await fetch(APP_CONFIG.GITHUB_RELEASES_API_URL, {
        headers: { Accept: "application/vnd.github+json" },
        signal,
      });
      if (!response.ok) {
        throw new Error(`GitHub answered ${response.status}`);
      }
      return newestAppUpdate(await response.json(), appVersion);
    },
    enabled: isGitHubApk,
    staleTime: Infinity,
    retry: false,
  });
}
