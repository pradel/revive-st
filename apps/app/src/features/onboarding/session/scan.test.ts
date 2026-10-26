import { describe, expect, it } from "vite-plus/test";

import type { ScanResult } from "./ports";
import { homeNetworkCandidates, isSetupNetwork, setupSuffix } from "./scan";

const OPEN = "[ESS]";
const WPA2 = "[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]";

function ap(
  ssid: string,
  frequencyMHz: number,
  level: number,
  capabilities = WPA2,
): ScanResult {
  return {
    ssid,
    bssid: `${ssid}-${frequencyMHz}-${level}`,
    frequencyMHz,
    level,
    capabilities,
  };
}

describe("setupSuffix", () => {
  it.each([
    ["Bose ST 10 (DDEEFF)", "DDEEFF"],
    ["Bose SoundTouch 20 (a1b2c3)", "A1B2C3"],
    ["bose st 300 (0A0B0C) ", "0A0B0C"],
    ["Bose ST 10", null],
    ["Bose ST 10 (DDEEF)", null],
  ])("%s → %s", (ssid, suffix) => {
    expect(setupSuffix(ssid)).toBe(suffix);
  });
});

describe("isSetupNetwork", () => {
  it.each([
    "Bose ST 10 (DDEEFF)",
    "Bose SoundTouch 30 (112233)",
    "BOSE st 20 (ABCDEF)",
    "bose soundtouch (ABCDEF)",
  ])("accepts the open setup network %s", (ssid) => {
    expect(isSetupNetwork({ ssid, capabilities: OPEN })).toBe(true);
  });

  it.each([
    "BoseHome",
    "Bose Office",
    "My Bose ST 10 (DDEEFF)",
    "Bose Station",
    "Living room bose",
  ])("rejects the home network %s", (ssid) => {
    expect(isSetupNetwork({ ssid, capabilities: OPEN })).toBe(false);
  });

  it("rejects a secured network named like a setup network", () => {
    expect(
      isSetupNetwork({ ssid: "Bose ST 10 (DDEEFF)", capabilities: WPA2 }),
    ).toBe(false);
  });
});

describe("homeNetworkCandidates", () => {
  it("keeps the strongest entry per SSID and lists its bands", () => {
    const candidates = homeNetworkCandidates([
      ap("Home", 2437, -60),
      ap("Home", 5200, -48),
      ap("Home", 2412, -70),
      ap("Neighbour", 2462, -80),
    ]);

    expect(candidates).toEqual([
      { ssid: "Home", bands: ["2.4GHz", "5GHz"], security: "wpa", level: -48 },
      { ssid: "Neighbour", bands: ["2.4GHz"], security: "wpa", level: -80 },
    ]);
  });

  it("keeps 5 GHz-only SSIDs", () => {
    expect(homeNetworkCandidates([ap("Office5G", 5180, -67)])).toEqual([
      { ssid: "Office5G", bands: ["5GHz"], security: "wpa", level: -67 },
    ]);
  });

  it("excludes setup networks and hidden SSIDs", () => {
    const candidates = homeNetworkCandidates([
      ap("Bose ST 10 (DDEEFF)", 2412, -40, OPEN),
      ap("", 2437, -50),
      ap("   ", 2437, -50),
      ap("Home", 2437, -60),
    ]);

    expect(candidates.map((network) => network.ssid)).toEqual(["Home"]);
  });

  it("reads security from capabilities", () => {
    const candidates = homeNetworkCandidates([
      ap("Open", 2437, -50, "[ESS]"),
      ap("Wpa2", 2437, -51, "[WPA2-PSK-CCMP][ESS]"),
      ap("Wpa3", 2437, -52, "[RSN-SAE-CCMP][ESS]"),
      ap("Transition", 2437, -53, "[RSN-PSK+SAE-CCMP][ESS]"),
      ap("Enterprise", 2437, -54, "[WPA2-EAP-CCMP][ESS]"),
    ]);

    expect(
      Object.fromEntries(
        candidates.map((network) => [network.ssid, network.security]),
      ),
    ).toEqual({
      Open: "open",
      Wpa2: "wpa",
      Wpa3: "wpa3",
      Transition: "wpa",
      Enterprise: "unsupported",
    });
  });
});
