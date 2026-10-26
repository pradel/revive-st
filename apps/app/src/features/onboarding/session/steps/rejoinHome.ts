import { Result } from "better-result";

import { createWakeup, withTimeout } from "../async";
import { HomeWifiNotRestored } from "../errors";
import type { NetworkState } from "../ports";
import type { StepEnv } from "./env";

export const REJOIN_HOME_TIMEOUT_MS = 45_000;

function onHomeWifi(network: NetworkState, ssid: string): boolean {
  return (
    network.transport === "wifi" &&
    (network.ssid === null || network.ssid === ssid)
  );
}

/**
 * Done when the phone's default network is Wi-Fi on `ssid` (any Wi-Fi when the
 * SSID is unreadable). Usually immediate: the phone kept its home connection.
 */
export async function rejoinHome(
  env: StepEnv,
  signal: AbortSignal,
  ssid: string,
): Promise<Result<void, HomeWifiNotRestored>> {
  const { wifi, clock } = env.deps;
  env.working("rejoinHome", { kind: "waitingForHomeWifi", ssid });
  const changed = createWakeup();
  const unsubscribe = wifi.onNetworkChange(changed.notify);
  try {
    return await withTimeout(
      clock,
      REJOIN_HOME_TIMEOUT_MS,
      signal,
      async (waiting): Promise<Result<void, never>> => {
        while (!onHomeWifi(await wifi.currentNetwork(), ssid)) {
          await changed.wait(waiting);
        }
        return Result.ok(undefined);
      },
      () => new HomeWifiNotRestored({ ssid }),
    );
  } finally {
    unsubscribe();
  }
}
