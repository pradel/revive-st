import { describe, expect, it } from "vite-plus/test";

import { shortVersion } from "./firmware";

describe("shortVersion", () => {
  it("keeps the release of a SoundTouch build string", () => {
    expect(
      shortVersion(
        "27.0.6.46330.5043500 epdbuild.trunk.hepdswbld04.2022-08-04T11:20:29",
      ),
    ).toBe("27.0.6");
  });

  it("keeps a version shorter than three parts whole", () => {
    expect(shortVersion("4.8")).toBe("4.8");
  });

  it("returns a string that isn't a version as it is", () => {
    expect(shortVersion(" unknown ")).toBe("unknown");
  });
});
