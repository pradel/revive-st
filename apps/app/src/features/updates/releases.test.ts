import { describe, expect, it } from "vite-plus/test";

import { newestAppUpdate } from "./releases";

const apk = (version: string) => ({ name: `revive-st-${version}.apk` });

const releaseUrl = (version: string) =>
  `https://github.com/pradel/revive-st/releases/tag/%40revive-st%2Fapp%40${version}`;

const appRelease = (
  version: string,
  { assets = [apk(version)], prerelease = false, draft = false } = {},
) => ({
  tag_name: `@revive-st/app@${version}`,
  html_url: releaseUrl(version),
  assets,
  prerelease,
  draft,
});

describe("newestAppUpdate", () => {
  it("offers the newest app release with its APK, whatever the order", () => {
    expect(
      newestAppUpdate(
        [
          appRelease("0.0.6"),
          { tag_name: "@revive-st/api@0.0.9", assets: [], draft: false },
          appRelease("0.0.7"),
          appRelease("0.0.5"),
        ],
        "0.0.5",
      ),
    ).toEqual({ version: "0.0.7", releaseUrl: releaseUrl("0.0.7") });
  });

  it("offers nothing when this build is the newest release", () => {
    expect(
      newestAppUpdate([appRelease("0.0.5"), appRelease("0.0.4")], "0.0.5"),
    ).toBeNull();
  });

  it("skips a release whose APK isn't attached yet", () => {
    expect(
      newestAppUpdate(
        [appRelease("0.0.7", { assets: [] }), appRelease("0.0.6")],
        "0.0.5",
      ),
    ).toEqual({ version: "0.0.6", releaseUrl: releaseUrl("0.0.6") });
  });

  it("skips another release's APK, drafts and prereleases", () => {
    expect(
      newestAppUpdate(
        [
          appRelease("0.0.9", { assets: [apk("0.0.8")] }),
          appRelease("0.0.8", { draft: true }),
          appRelease("0.0.7", { prerelease: true }),
          { tag_name: "@revive-st/app@0.0.6-next.1", assets: [apk("0.0.6")] },
        ],
        "0.0.5",
      ),
    ).toBeNull();
  });

  it("offers nothing for an answer that isn't a list of releases", () => {
    expect(
      newestAppUpdate({ message: "API rate limit exceeded" }, "0.0.5"),
    ).toBeNull();
  });
});
