import { Platform } from "react-native";

export const SPEAKER_HOTSPOT_CANDIDATES = [
  "192.0.2.1",
  "192.168.1.1",
  "172.20.10.1",
  "192.168.0.1",
];

export const SPEAKER_PORT = 8090;
export const PROBE_TIMEOUT_MS = 2000;
export const CREDENTIALS_TIMEOUT_MS = 5000;
export const HOTSPOT_SCAN_TIMEOUT_MS = 15000;
export const MDNS_DISCOVERY_TIMEOUT_MS = 30000;

const SPEAKER_SSID_PATTERN = /bose\s*(st|soundtouch)/i;

export function isSpeakerHotspot(ssid: string): boolean {
  return SPEAKER_SSID_PATTERN.test(ssid);
}

export function normalizeSSID(ssid: string): string {
  return ssid;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildCredentialsPayload(
  ssid: string,
  password: string,
): string {
  return `<network><ssid>${escapeXml(ssid)}</ssid><password>${escapeXml(password)}</password></network>`;
}

export async function probeSpeakerIP(
  ip: string,
  timeout = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/info`, {
      signal: AbortSignal.timeout(timeout),
    });
    const ok = response.ok;
    console.log(`[IP Probe] ${ip} → ${ok ? "OK" : `HTTP ${response.status}`}`);
    return ok;
  } catch (err) {
    console.log(`[IP Probe] ${ip} → failed (${(err as Error).message})`);
    return false;
  }
}

export async function findSpeakerIP(
  timeout = PROBE_TIMEOUT_MS,
): Promise<string | null> {
  for (const ip of SPEAKER_HOTSPOT_CANDIDATES) {
    const alive = await probeSpeakerIP(ip, timeout);
    if (alive) return ip;
  }
  return null;
}

export async function sendCredentials(
  speakerIp: string,
  homeSSID: string,
  homePassword: string,
  timeout = CREDENTIALS_TIMEOUT_MS,
): Promise<void> {
  const payload = buildCredentialsPayload(homeSSID, homePassword);

  const response = await fetch(`http://${speakerIp}:${SPEAKER_PORT}/network`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: payload,
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(`Speaker returned HTTP ${response.status}`);
  }
}

export function usesSystemDialog(): boolean {
  return Platform.OS === "android" && Platform.Version >= 29;
}
