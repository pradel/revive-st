import type { Preset } from "bose-api-speaker-client";

import { APP_CONFIG } from "@/config";
import { logger } from "@/lib/logger";

import { isHouseholdAccountId, isSameOrigin } from "./account-id";

/** Whether a speaker's Marge server, the `margeURL` of its `/info`, is ours. */
export const usesOurServer = (margeURL: string | undefined) =>
  isSameOrigin(margeURL, APP_CONFIG.API_URL);

/** A new household account id, minted by our server. */
export async function mintAccountId(): Promise<string> {
  const response = await fetch(`${APP_CONFIG.API_URL}/api/internal/accounts`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      `Could not create an account: ${response.status} ${response.statusText}`,
    );
  }
  const { accountId } = (await response.json()) as { accountId?: unknown };
  if (typeof accountId !== "string" || !isHouseholdAccountId(accountId)) {
    throw new Error("The server returned an invalid account id");
  }
  return accountId;
}

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
