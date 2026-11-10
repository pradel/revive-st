import type { Preset } from "bose-api-speaker-client";

import { serverFetch } from "@/features/server/server";

/**
 * Stores a speaker's presets on the server at `origin`, under the account the
 * speaker is (or is about to be) paired with, replacing what was stored. The
 * speaker mirrors the stored presets at boot, so they must be there before it
 * reboots paired. Throws when the server can't be reached or refuses them.
 */
export async function syncPresetsToMarge(
  origin: string,
  accountId: string,
  deviceId: string,
  presets: Preset[],
  signal?: AbortSignal,
): Promise<void> {
  const url = `${origin}/api/internal/account/${encodeURIComponent(accountId)}/device/${encodeURIComponent(deviceId)}/presets`;
  const response = await serverFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ presets }),
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `Could not save presets: ${response.status} ${response.statusText}`,
    );
  }
}
