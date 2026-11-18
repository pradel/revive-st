import { describe, expect, it } from "vite-plus/test";

import { isSoundTouch10 } from "./models.ts";

describe("isSoundTouch10", () => {
  it.each(["SoundTouch 10", "soundtouch 10", "ST10", "ST 10"])(
    "takes %s for a SoundTouch 10",
    (type) => {
      expect(isSoundTouch10(type)).toBe(true);
    },
  );

  it.each([
    "SoundTouch 20",
    "SoundTouch 30",
    "SoundTouch 300",
    "SoundTouch Portable",
    "",
  ])("doesn't take %s for one", (type) => {
    expect(isSoundTouch10(type)).toBe(false);
  });
});
