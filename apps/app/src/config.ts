export const APP_CONFIG = {
  GITHUB_URL: "https://github.com/pradel/revive-st",
  /**
   * The repository's latest releases, the app's and the server's: as many as
   * GitHub returns at once, so server releases can't push the app's off.
   */
  GITHUB_RELEASES_API_URL:
    "https://api.github.com/repos/pradel/revive-st/releases?per_page=100",
  FEEDBACK_URL: "https://github.com/pradel/revive-st/discussions",
  /** GitHub Sponsors: linked from the GitHub APK only, the stores forbid it. */
  SPONSOR_URL: "https://github.com/sponsors/pradel",
  WEBSITE_URL: "https://www.revivest.app",
  /** What changed in each release of the app. */
  CHANGELOG_URL: "https://www.revivest.app/changelog/app",
  /** What the app and the hosted server collect. */
  PRIVACY_URL: "https://www.revivest.app/privacy",
  /** The terms of using the app and the hosted server. */
  TERMS_URL: "https://www.revivest.app/terms",
  /** Where crash reports go. */
  POSTHOG_HOST: "https://us.i.posthog.com",
};
