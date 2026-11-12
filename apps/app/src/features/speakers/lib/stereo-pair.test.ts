import { describe, expect, it } from "vite-plus/test";

import type { BoseSpeaker } from "../registry/types";
import {
  defaultPairName,
  isSoundTouch10,
  pairProblem,
  partnerProblem,
  validatePairName,
} from "./stereo-pair";

const ACCOUNT = "6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b";
const OTHER_ACCOUNT = "0b7a9c1e-2d3f-4a5b-9c6d-7e8f9a0b1c2d";

const ON_OUR_SERVER = {
  kind: "ready",
  serverName: "Revive ST",
  margeURL: "https://api.revivest.app",
  through: null,
  setup: { kind: "again" },
  sources: { radioBrowser: true, customStations: true },
} as const;

/** A SoundTouch 10 that can pair: reached, stereo capable, on our server. */
const st10 = (
  deviceID: string,
  overrides: Partial<BoseSpeaker> = {},
): BoseSpeaker => ({
  deviceID,
  status: "online",
  host: "192.168.1.195",
  port: 8090,
  name: deviceID,
  speakerName: deviceID,
  type: "SoundTouch 10",
  radio: ON_OUR_SERVER,
  capabilities: { deviceID, capabilities: [], lrStereoCapable: true },
  margeAccountUUID: ACCOUNT,
  ...overrides,
});

const LIVING_ROOM = st10("0CAE7D6298E9");

describe("pairProblem", () => {
  it("lets a reached SoundTouch 10 on our server, in no pair or zone, pair", () => {
    expect(pairProblem(LIVING_ROOM, false)).toBeUndefined();
  });

  it.each([
    ["offline", st10("A", { status: "offline" }), false],
    ["connecting", st10("A", { status: "connecting" }), false],
  ])("needs the speaker reached (%s)", (_status, speaker, inZone) => {
    expect(pairProblem(speaker, inZone)).toBe("offline");
  });

  it("needs a speaker that says it can play in stereo", () => {
    expect(
      pairProblem(
        st10("A", {
          capabilities: { deviceID: "A", capabilities: [] },
        }),
        false,
      ),
    ).toBe("noStereo");
  });

  it("needs a speaker in no pair", () => {
    const pair = {
      id: "3271058",
      name: "Pair",
      masterDeviceID: "A",
      roles: [{ deviceID: "A", role: "LEFT" as const }],
    };
    expect(pairProblem(st10("A", { pair }), false)).toBe("paired");
  });

  it("needs the speaker on our server, with a household account", () => {
    expect(
      pairProblem(
        st10("A", { radio: { ...ON_OUR_SERVER, through: "soundcork" } }),
        false,
      ),
    ).toBe("otherServer");
    expect(
      pairProblem(st10("A", { radio: { kind: "unreachable" } }), false),
    ).toBe("otherServer");
    expect(pairProblem(st10("A", { margeAccountUUID: "" }), false)).toBe(
      "noAccount",
    );
  });

  it("needs a speaker in no multiroom zone, and waits for its zone and radio", () => {
    expect(pairProblem(LIVING_ROOM, true)).toBe("inZone");
    expect(pairProblem(LIVING_ROOM, undefined)).toBe("checking");
    expect(pairProblem(st10("A", { radio: { kind: "checking" } }), false)).toBe(
      "checking",
    );
  });
});

describe("partnerProblem", () => {
  it("needs the partner on the same household account", () => {
    expect(
      partnerProblem(
        LIVING_ROOM,
        st10("EC1127C25A50", { margeAccountUUID: OTHER_ACCOUNT }),
        false,
      ),
    ).toBe("otherAccount");
    expect(
      partnerProblem(LIVING_ROOM, st10("EC1127C25A50"), false),
    ).toBeUndefined();
  });

  it("names the partner's own problem first", () => {
    expect(
      partnerProblem(
        LIVING_ROOM,
        st10("EC1127C25A50", {
          status: "offline",
          margeAccountUUID: OTHER_ACCOUNT,
        }),
        false,
      ),
    ).toBe("offline");
  });
});

describe("stereo pair names and models", () => {
  it("tells a SoundTouch 10 from other models", () => {
    expect(isSoundTouch10("SoundTouch 10")).toBe(true);
    expect(isSoundTouch10("SoundTouch 20")).toBe(false);
    expect(isSoundTouch10("SoundTouch Portable")).toBe(false);
  });

  it("names a new pair after its speakers, within 64 characters", () => {
    expect(defaultPairName("Living room", "Office")).toBe(
      "Living room + Office",
    );
    expect(defaultPairName("L".repeat(40), "R".repeat(40))).toHaveLength(64);
  });

  it("takes a name of 1 to 64 characters", () => {
    expect(validatePairName("  ")).toBeDefined();
    expect(validatePairName("x".repeat(65))).toBeDefined();
    expect(validatePairName(" Living room + Office ")).toBeUndefined();
  });
});
