import { securityTypeOf } from "./credentials";
import type { ScanResult } from "./ports";
import type { Band, HomeNetwork } from "./types";

const SETUP_SSID = /^bose\s*(?:st|soundtouch)\b/i;
const SETUP_SUFFIX = /\(([0-9a-f]{6})\)\s*$/i;

/** Last 6 hex characters of the speaker's deviceID, from `Bose ST 10 (DDEEFF)`; upper-case. */
export function setupSuffix(ssid: string): string | null {
  const match = SETUP_SUFFIX.exec(ssid);
  return match ? match[1].toUpperCase() : null;
}

/** An open network named like a SoundTouch setup network. */
export function isSetupNetwork(
  network: Pick<ScanResult, "ssid" | "capabilities">,
): boolean {
  return (
    SETUP_SSID.test(network.ssid.trim()) &&
    securityTypeOf(network.capabilities) === "open"
  );
}

/** Setup networks deduplicated by BSSID, strongest first. */
export function setupNetworks(results: readonly ScanResult[]): ScanResult[] {
  const byBssid = new Map<string, ScanResult>();
  for (const result of results.filter(isSetupNetwork)) {
    const key = result.bssid.toLowerCase();
    const existing = byBssid.get(key);
    if (!existing || result.level > existing.level) {
      byBssid.set(key, result);
    }
  }
  return [...byBssid.values()].sort((a, b) => b.level - a.level);
}

export function bandOf(frequencyMHz: number): Band | null {
  if (frequencyMHz >= 2400 && frequencyMHz < 2500) {
    return "2.4GHz";
  }
  if (frequencyMHz >= 4900 && frequencyMHz < 5925) {
    return "5GHz";
  }
  if (frequencyMHz >= 5925 && frequencyMHz <= 7125) {
    return "6GHz";
  }
  return null;
}

const BAND_ORDER: readonly Band[] = ["2.4GHz", "5GHz", "6GHz"];

/**
 * Networks the speaker could join: one entry per SSID (strongest entry decides
 * security and level), every band seen, setup networks and hidden SSIDs
 * excluded, strongest first.
 */
export function homeNetworkCandidates(
  results: readonly ScanResult[],
): HomeNetwork[] {
  const bySsid = new Map<string, { strongest: ScanResult; bands: Set<Band> }>();
  const visible = results.filter(
    (result) => result.ssid.trim() !== "" && !isSetupNetwork(result),
  );
  for (const result of visible) {
    const entry = bySsid.get(result.ssid) ?? {
      strongest: result,
      bands: new Set<Band>(),
    };
    if (result.level > entry.strongest.level) {
      entry.strongest = result;
    }
    const band = bandOf(result.frequencyMHz);
    if (band) {
      entry.bands.add(band);
    }
    bySsid.set(result.ssid, entry);
  }
  return [...bySsid.entries()]
    .map(([ssid, { strongest, bands }]) => ({
      ssid,
      bands: BAND_ORDER.filter((band) => bands.has(band)),
      security: securityTypeOf(strongest.capabilities),
      level: strongest.level,
    }))
    .sort((a, b) => b.level - a.level);
}
