import { Platform } from "react-native";

export const SPEAKER_HOTSPOT_CANDIDATES = [
  "192.0.2.1",
  "192.0.2.50",
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
  const securityType = password ? "wpa_or_wpa2" : "none";
  return `<AddWirelessProfile timeout="30"><profile ssid="${escapeXml(
    ssid,
  )}" password="${escapeXml(password)}" securityType="${securityType}"></profile></AddWirelessProfile>`;
}

export async function probeSpeakerIP(
  ip: string,
  timeout = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/info`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      console.log(`[IP Probe] ${ip} → failed (HTTP ${response.status})`);
      return false;
    }
    const text = await response.text();
    const isBose = text.includes("<info") && text.includes("deviceID");
    if (isBose) {
      const nameMatch = text.match(/<name>(.*?)<\/name>/);
      const name = nameMatch ? nameMatch[1] : "Bose Speaker";
      console.log(`[IP Probe] ${ip} → OK (Verified Bose Device: ${name})`);
      return true;
    }
    console.log(`[IP Probe] ${ip} → failed (not a Bose device)`);
    return false;
  } catch (err) {
    clearTimeout(id);
    console.log(`[IP Probe] ${ip} → failed (${(err as Error).message})`);
    return false;
  }
}

export async function findSpeakerIP(
  timeout = PROBE_TIMEOUT_MS,
): Promise<string | null> {
  for (const ip of SPEAKER_HOTSPOT_CANDIDATES) {
    const alive = await probeSpeakerIP(ip, timeout);
    console.log(
      "Probe result for",
      ip,
      ":",
      alive ? "alive" : "not responding",
    );
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
  const url = `http://${speakerIp}:${SPEAKER_PORT}/addWirelessProfile`;
  console.log(`[Send Creds] Sending POST to ${url}`);
  console.log(`[Send Creds] Headers: { "Content-Type": "application/xml" }`);
  console.log(`[Send Creds] Payload: ${payload}`);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: payload,
      signal: controller.signal,
    });
    clearTimeout(id);

    console.log(
      `[Send Creds] Response status: ${response.status} (${response.statusText || "unknown"})`,
    );
    const text = await response.text();
    console.log(`[Send Creds] Response body: ${text}`);

    if (!response.ok) {
      throw new Error(`Speaker returned HTTP ${response.status}: ${text}`);
    }
  } catch (err) {
    clearTimeout(id);
    const errMsg = (err as Error).message || "";
    const errName = (err as Error).name || "";
    console.log(`[Send Creds] Exception thrown: ${errName} - ${errMsg}`);

    const isAbortOrNetworkError =
      errName === "AbortError" ||
      errMsg.toLowerCase().includes("abort") ||
      errMsg.toLowerCase().includes("network request failed") ||
      errMsg.toLowerCase().includes("failed to connect") ||
      errMsg.toLowerCase().includes("connection") ||
      errMsg.toLowerCase().includes("timeout");

    if (isAbortOrNetworkError) {
      console.log(
        `[Send Creds] Treating abort/network error as success (AP likely shut down by speaker)`,
      );
      return;
    }
    throw err;
  }
}

export function usesSystemDialog(): boolean {
  return Platform.OS === "android" && Platform.Version >= 29;
}
