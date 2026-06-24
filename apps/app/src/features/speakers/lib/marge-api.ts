import type { Preset } from "bose-api-speaker-client";

import { logger } from "@/lib/logger";

// The app knows the URL via telnet configuration, but we use the known domain here.
const MARGE_API_BASE_URL = "https://api.revivest.app";

/**
 * Pushes updated presets to the Marge API server for a specific device.
 */
export async function syncPresetsToMarge(
  deviceId: string,
  presets: Preset[],
): Promise<void> {
  try {
    const url = `${MARGE_API_BASE_URL}/api/internal/device/${encodeURIComponent(deviceId)}/presets`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ presets }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync presets: ${response.statusText}`);
    }
  } catch (error) {
    // In a real production app we might retry, but logging is fine for now
    logger.warn(`[marge-api] Could not sync presets for ${deviceId}:`, error);
  }
}
