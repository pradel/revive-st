import type { Preset } from "bose-api-speaker-client";

import { APP_CONFIG } from "@/config";
import { logger } from "@/lib/logger";

/**
 * Pushes a speaker's presets to our server, under the account the speaker is
 * paired with, so the speaker gets them back from the Marge API.
 */
export async function syncPresetsToMarge(
  accountId: string,
  deviceId: string,
  presets: Preset[],
): Promise<void> {
  try {
    const url = `${APP_CONFIG.API_URL}/api/internal/account/${encodeURIComponent(accountId)}/device/${encodeURIComponent(deviceId)}/presets`;
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
