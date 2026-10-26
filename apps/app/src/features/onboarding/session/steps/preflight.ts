import { Result } from "better-result";

import { childController, createWakeup } from "../async";
import {
  LocationServicesOff,
  PermissionCoarse,
  PermissionDenied,
} from "../errors";
import type { StepEnv } from "./env";

export interface PreflightOptions {
  /** Show the rationale prompt (first entry only). */
  rationale: boolean;
  /** Ask for the permission if not granted (otherwise only check). */
  request: boolean;
}

export interface PreflightResult {
  /** SSID of the Wi-Fi the phone was on, if any. */
  homeSsid: string | null;
}

/**
 * Done when fine location is granted, location services are on and Wi-Fi is
 * on. Wi-Fi off is not an error: the step waits for `onNetworkChange`.
 */
export async function preflight(
  env: StepEnv,
  signal: AbortSignal,
  options: PreflightOptions,
): Promise<
  Result<
    PreflightResult,
    PermissionDenied | PermissionCoarse | LocationServicesOff
  >
> {
  const { permissions, wifi } = env.deps;
  if (options.rationale) {
    await env.ask(signal, { kind: "rationale" }, (answer) =>
      answer.kind === "continue" ? true : undefined,
    );
  }
  env.working("preflight", { kind: "checkingPermissions" });
  const permission = await permissions.location(options.request);
  if (!permission.granted) {
    return Result.err(
      new PermissionDenied({ canAskAgain: permission.canAskAgain }),
    );
  }
  if (!permission.fine) {
    return Result.err(new PermissionCoarse());
  }
  if (!(await permissions.locationServicesEnabled())) {
    return Result.err(new LocationServicesOff());
  }
  if (!(await wifi.isEnabled())) {
    await waitForWifi(env, signal);
  }
  const network = await wifi.currentNetwork();
  return Result.ok({
    homeSsid: network.transport === "wifi" ? network.ssid : null,
  });
}

async function waitForWifi(env: StepEnv, signal: AbortSignal): Promise<void> {
  const { wifi } = env.deps;
  const waiting = childController(signal);
  try {
    env.working("preflight", { kind: "wifiOff" });
    env.listen(waiting.signal, (answer) => {
      if (answer.kind !== "action" || answer.action !== "openWifiPanel") {
        return false;
      }
      wifi.openWifiPanel().catch(() => undefined);
      return true;
    });
    const changed = createWakeup();
    const unsubscribe = wifi.onNetworkChange(changed.notify);
    try {
      while (!(await wifi.isEnabled())) {
        await changed.wait(waiting.signal);
      }
    } finally {
      unsubscribe();
    }
  } finally {
    waiting.dispose();
  }
}
