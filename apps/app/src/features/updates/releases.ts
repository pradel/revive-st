import { isAtLeast } from "../server/server-version";

/** An app release's tag, as Changesets names it. */
const APP_TAG = /^@revive-st\/app@(\d+\.\d+\.\d+)$/;

/** A newer release of the app, and its page on GitHub, where its APK is. */
export interface AppUpdate {
  readonly version: string;
  readonly releaseUrl: string;
}

/** `release`, one of GitHub's releases, if it's an app release with its APK. */
function appReleaseWithApk(release: unknown): AppUpdate | null {
  if (typeof release !== "object" || release === null) {
    return null;
  }
  const { tag_name, draft, prerelease, assets, html_url } = release as Record<
    string,
    unknown
  >;
  const version =
    typeof tag_name === "string" ? APP_TAG.exec(tag_name)?.[1] : undefined;
  if (
    version === undefined ||
    draft === true ||
    prerelease === true ||
    typeof html_url !== "string" ||
    !Array.isArray(assets)
  ) {
    return null;
  }
  const hasApk = (assets as unknown[]).some(
    (asset) =>
      typeof asset === "object" &&
      asset !== null &&
      (asset as Record<string, unknown>).name === `revive-st-${version}.apk`,
  );
  return hasApk ? { version, releaseUrl: html_url } : null;
}

/**
 * The newest app release in `releases`, GitHub's list of the repository's
 * releases, that is newer than `current` and has its APK attached
 * (`revive-st-<version>.apk`, which `vp run release:app` uploads after the
 * release is created). Drafts, prereleases and the server's releases are
 * skipped.
 */
export function newestAppUpdate(
  releases: unknown,
  current: string,
): AppUpdate | null {
  if (!Array.isArray(releases)) {
    return null;
  }
  return (releases as unknown[])
    .map(appReleaseWithApk)
    .reduce<AppUpdate | null>(
      (newest, update) =>
        update !== null &&
        !isAtLeast(current, update.version) &&
        (newest === null || !isAtLeast(newest.version, update.version))
          ? update
          : newest,
      null,
    );
}
