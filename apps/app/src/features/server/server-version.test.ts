import { describe, expect, it } from "vite-plus/test";

import {
  checkServerStatus,
  isAtLeast,
  REVIVE_SERVER_NAME,
} from "./server-version";

describe("isAtLeast", () => {
  it.each([
    ["0.0.3", "0.0.3", true],
    ["0.0.4", "0.0.3", true],
    ["0.1.0", "0.0.9", true],
    ["1.0.0", "0.9.9", true],
    ["0.10.0", "0.9.0", true],
    ["0.0.3+build.5", "0.0.3", true],
    ["0.0.2", "0.0.3", false],
    ["0.9.0", "0.10.0", false],
    ["0.0.3-next.1", "0.0.3", false],
    ["0.0.4-next.1", "0.0.3", true],
    ["0.0", "0.0.3", false],
    ["v0.0.3", "0.0.3", false],
    ["", "0.0.3", false],
  ])("%j against %j is %s", (version, minimum, expected) => {
    expect(isAtLeast(version, minimum)).toBe(expected);
  });
});

describe("checkServerStatus", () => {
  it("accepts a Revive ST server at the minimum version or newer", () => {
    expect(
      checkServerStatus(
        { name: REVIVE_SERVER_NAME, version: "0.2.0" },
        "0.2.0",
      ),
    ).toEqual({ kind: "supported", version: "0.2.0" });
  });

  it("names a Revive ST server below the minimum too old", () => {
    expect(
      checkServerStatus(
        { name: REVIVE_SERVER_NAME, version: "0.1.9" },
        "0.2.0",
      ),
    ).toEqual({ kind: "tooOld", version: "0.1.9" });
  });

  it("counts a Revive ST server that reports no version as too old", () => {
    expect(checkServerStatus({ name: REVIVE_SERVER_NAME }, "0.2.0")).toEqual({
      kind: "tooOld",
      version: null,
    });
  });

  it.each([null, "Revive ST API", [], { name: "soundcork", version: "9.9.9" }])(
    "tells %j isn't a Revive ST server",
    (status) => {
      expect(checkServerStatus(status, "0.2.0")).toEqual({ kind: "notRevive" });
    },
  );
});
