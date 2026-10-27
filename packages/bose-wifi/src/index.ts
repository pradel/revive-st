import BoseWifiModule, { type LinkEvent } from "./BoseWifiModule";

export type { LinkEvent } from "./BoseWifiModule";

export type JoinErrorCode =
  | "JOIN_UNAVAILABLE"
  | "JOIN_SUPERSEDED"
  | "JOIN_RELEASED"
  | "REQUEST_FAILED";

/** Requests the speaker AP and binds the process to it. Rejects with an Error whose `code` is a JoinErrorCode. */
export async function join(
  ssid: string,
  bssid: string,
  timeoutMs: number,
): Promise<void> {
  await BoseWifiModule.join(ssid, bssid, timeoutMs);
}

/** Rejects a pending join, unregisters the request and unbinds. Idempotent; never rejects. */
export async function release(): Promise<void> {
  try {
    await BoseWifiModule.release();
  } catch {
    // Release is best-effort cleanup.
  }
}

/** Binds the process to the currently connected Wi-Fi network; `false` if there is none. */
export async function bindToConnectedWifi(): Promise<boolean> {
  return BoseWifiModule.bindToConnectedWifi();
}

export async function openWifiPanel(): Promise<void> {
  await BoseWifiModule.openWifiPanel();
}

export function addLinkListener(
  event: LinkEvent,
  listener: () => void,
): { remove: () => void } {
  return BoseWifiModule.addListener(event, listener);
}

export async function openWifiSettings(): Promise<void> {
  await BoseWifiModule.openWifiSettings();
}
