import type { Preset } from "bose-api-speaker-client";

import { getServerUrl } from "@/features/server/server";

import { isHouseholdAccountId, isSameOrigin } from "./account-id";

/** Whether a speaker's Marge server, the `margeURL` of its `/info`, is ours. */
export const usesOurServer = (margeURL: string | undefined) =>
  isSameOrigin(margeURL, getServerUrl());

/** A new household account id, minted by our server. */
export async function mintAccountId(): Promise<string> {
  const response = await fetch(`${getServerUrl()}/api/internal/accounts`, {
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
 * Stores a speaker's presets on our server, under the account the speaker is
 * (or is about to be) paired with, replacing what was stored. The speaker
 * mirrors the stored presets at boot, so they must be there before it
 * reboots paired. Throws when the server can't be reached or refuses them.
 */
export async function syncPresetsToMarge(
  accountId: string,
  deviceId: string,
  presets: Preset[],
): Promise<void> {
  const url = `${getServerUrl()}/api/internal/account/${encodeURIComponent(accountId)}/device/${encodeURIComponent(deviceId)}/presets`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ presets }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not save presets: ${response.status} ${response.statusText}`,
    );
  }
}
