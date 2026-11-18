import { describe, expect, it } from "vite-plus/test";

import { reachedPartner, validatePairName } from "./stereo-pair";

describe("validatePairName", () => {
  it("takes a name of 1 to 64 characters", () => {
    expect(validatePairName("  ")).toBeDefined();
    expect(validatePairName("x".repeat(65))).toBeDefined();
    expect(validatePairName(" Living room + Office ")).toBeUndefined();
  });
});

describe("reachedPartner", () => {
  const pair = {
    id: "3271058",
    name: "Living room + Office",
    masterDeviceID: "0CAE7D6298E9",
    roles: [
      { deviceID: "0CAE7D6298E9", role: "LEFT" },
      { deviceID: "EC1127C25A50", role: "RIGHT" },
    ],
  } as const;
  const master = { deviceID: "0CAE7D6298E9", status: "offline", pair } as const;
  const partner = { deviceID: "EC1127C25A50", status: "online", pair } as const;

  it("finds the reached partner of an offline master's pair", () => {
    expect(reachedPartner(master, [master, partner])).toBe(partner.deviceID);
  });

  it("finds none for a master that answers, or a partner offline, in another pair or in none", () => {
    expect(
      reachedPartner({ ...master, status: "online" }, [master, partner]),
    ).toBeUndefined();
    for (const other of [
      { ...partner, status: "offline" as const },
      { ...partner, pair: { ...pair, id: "2222222" } },
      { ...partner, pair: undefined },
    ]) {
      expect(reachedPartner(master, [master, other])).toBeUndefined();
    }
  });
});
