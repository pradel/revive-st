import type { Result } from "better-result";
import { describe, expect, it } from "vite-plus/test";

import {
  type CredentialsInvalid,
  type ValidCredentials,
  validateCredentials,
} from "./credentials";

const problem = (result: Result<ValidCredentials, CredentialsInvalid>) =>
  result.isErr() ? result.error.problem : "ok";

describe("validateCredentials", () => {
  it("accepts an open network with an empty password", () => {
    const result = validateCredentials({ ssid: "Cafe", password: "" }, "open");

    expect(result.isOk() && result.value).toEqual({
      credentials: { ssid: "Cafe", password: "" },
      warnings: [],
    });
  });

  it("never sends a password to an open network", () => {
    const result = validateCredentials(
      { ssid: "Cafe", password: "typed-anyway" },
      "open",
    );

    expect(result.isOk() && result.value.credentials.password).toBe("");
  });

  it.each([
    [7, "passwordTooShort"],
    [8, "ok"],
    [63, "ok"],
    [64, "passwordTooLong"],
  ])("WPA password of %i characters → %s", (length, expected) => {
    expect(
      problem(
        validateCredentials(
          { ssid: "Home", password: "x".repeat(length) },
          "wpa",
        ),
      ),
    ).toBe(expected);
  });

  it("requires a password on WPA networks", () => {
    expect(
      problem(validateCredentials({ ssid: "Home", password: "" }, "wpa")),
    ).toBe("passwordRequired");
  });

  it("warns about WPA3-only networks", () => {
    const result = validateCredentials(
      { ssid: "Home", password: "longenough" },
      "wpa3",
    );

    expect(result.isOk() && result.value.warnings).toEqual(["wpa3Only"]);
  });

  it.each(["", "   "])("rejects the empty SSID %j", (ssid) => {
    expect(
      problem(validateCredentials({ ssid, password: "longenough" }, "wpa")),
    ).toBe("ssidEmpty");
  });

  it("accepts an SSID with XML special characters", () => {
    const ssid = `Net"work & <Home> 'Wi-Fi'`;
    const result = validateCredentials({ ssid, password: "longenough" }, "wpa");

    expect(result.isOk() && result.value.credentials.ssid).toBe(ssid);
  });

  it("treats a manually entered SSID without password as open", () => {
    const result = validateCredentials(
      { ssid: "Hidden", password: "" },
      undefined,
    );

    expect(result.isOk() && result.value.credentials).toEqual({
      ssid: "Hidden",
      password: "",
    });
    expect(
      problem(
        validateCredentials({ ssid: "Hidden", password: "short" }, undefined),
      ),
    ).toBe("passwordTooShort");
  });

  it("rejects networks the speaker cannot join", () => {
    expect(
      problem(
        validateCredentials(
          { ssid: "Corp", password: "longenough" },
          "unsupported",
        ),
      ),
    ).toBe("unsupportedSecurity");
  });
});
