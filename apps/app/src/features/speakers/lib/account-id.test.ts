import { describe, expect, it } from "vite-plus/test";

import {
  isSafeAccountId,
  pickHouseholdAccountId,
  type SpeakerAccount,
} from "./account-id";

const SERVER = "https://api.revivest.app";
const MINTED = "6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b";
const OTHER_MINTED = "0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d";

const onServer = (margeAccountId: string): SpeakerAccount => ({
  margeAccountId,
  margeURL: SERVER,
});

describe("pickHouseholdAccountId", () => {
  it("joins the account another speaker on our server uses", () => {
    expect(
      pickHouseholdAccountId({
        otherSpeakers: [onServer(MINTED)],
        storedAccountId: OTHER_MINTED,
        serverUrl: SERVER,
      }),
    ).toBe(MINTED);
  });

  it.each([
    ["the old shared account", onServer("revivest-user")],
    ["a Bose cloud account number", onServer("1234567")],
    [
      "an account on another server",
      { margeAccountId: MINTED, margeURL: "https://other.example" },
    ],
    ["an unpaired speaker", onServer("")],
  ])("never spreads %s", (_label, other) => {
    expect(
      pickHouseholdAccountId({
        otherSpeakers: [other],
        storedAccountId: null,
        serverUrl: SERVER,
      }),
    ).toBeUndefined();
  });

  it("falls back to the account this phone used before", () => {
    expect(
      pickHouseholdAccountId({
        otherSpeakers: [onServer("revivest-user")],
        storedAccountId: MINTED,
        serverUrl: SERVER,
      }),
    ).toBe(MINTED);
  });

  it("ignores a stored account the server did not mint", () => {
    expect(
      pickHouseholdAccountId({
        otherSpeakers: [],
        storedAccountId: "revivest-user",
        serverUrl: SERVER,
      }),
    ).toBeUndefined();
  });
});

describe("isSafeAccountId", () => {
  it.each([MINTED, "1234567", "revivest-user"])("accepts %s", (accountId) => {
    expect(isSafeAccountId(accountId)).toBe(true);
  });

  it.each(["", "a b", "a;sys reboot", "a\nb", "<x>"])(
    "rejects %j",
    (accountId) => {
      expect(isSafeAccountId(accountId)).toBe(false);
    },
  );
});
