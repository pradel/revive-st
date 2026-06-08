import { logger } from "@/lib/logger";

export const SPEAKER_HOTSPOT_CANDIDATES = [
  "192.0.2.1",
  "192.0.2.50",
  "192.168.1.1",
  "172.20.10.1",
  "192.168.0.1",
];

export const SPEAKER_PORT = 8090;
export const PROBE_TIMEOUT_MS = 2000;
export const MDNS_DISCOVERY_TIMEOUT_MS = 180000;

const SPEAKER_SSID_PATTERN = /bose\s*(st|soundtouch)/i;

export function isSpeakerHotspot(ssid: string): boolean {
  return SPEAKER_SSID_PATTERN.test(ssid);
}

export async function probeSpeakerIP(
  ip: string,
  timeout = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort();
  }, timeout);
  try {
    const response = await fetch(`http://${ip}:${SPEAKER_PORT}/info`, {
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!response.ok) {
      logger.log(`[IP Probe] ${ip} → failed (HTTP ${response.status})`);
      return false;
    }
    const text = await response.text();
    const isBose = text.includes("<info") && text.includes("deviceID");
    if (isBose) {
      const nameMatch = /<name>(.*?)<\/name>/.exec(text);
      const name = nameMatch ? nameMatch[1] : "Bose Speaker";
      logger.log(`[IP Probe] ${ip} → OK (Verified Bose Device: ${name})`);
      return true;
    }
    logger.log(`[IP Probe] ${ip} → failed (not a Bose device)`);
    return false;
  } catch (err) {
    clearTimeout(id);
    logger.log(`[IP Probe] ${ip} → failed (${(err as Error).message})`);
    return false;
  }
}

export async function findSpeakerIP(
  timeout = PROBE_TIMEOUT_MS,
): Promise<string | null> {
  for (const ip of SPEAKER_HOTSPOT_CANDIDATES) {
    const alive = await probeSpeakerIP(ip, timeout);
    logger.log("Probe result for", ip, ":", alive ? "alive" : "not responding");
    if (alive) {
      return ip;
    }
  }
  return null;
}
