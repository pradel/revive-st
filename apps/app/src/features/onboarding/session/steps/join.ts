import { Result } from "better-result";

import { withTimeout } from "../async";
import {
  type JoinRejected,
  JoinTimeout,
  type ManualJoinNotConnected,
  SpeakerUnreachable,
} from "../errors";
import type { Link, ScanResult } from "../ports";
import { setupSuffix } from "../scan";
import type { SpeakerIdentity } from "../types";
import { probeInfo, SETUP_IP, type StepEnv } from "./env";

/** Upper bound for Android's network request (also passed to the native module). */
export const JOIN_TIMEOUT_MS = 90_000;
/** `onAvailable` → `/info` answering took ≤ 3.2 s. */
export const JOIN_PROBE_BUDGET_MS = 10_000;
export const JOIN_PROBE_INTERVAL_MS = 1000;

export interface Joined {
  identity: SpeakerIdentity;
  link: Link;
}

export type JoinError =
  | JoinRejected
  | JoinTimeout
  | SpeakerUnreachable
  | ManualJoinNotConnected;

/**
 * `auto` joins `target`; `manual` asks the user to connect in the Wi-Fi
 * settings, then binds to that network. Without a target (scanning never found
 * the speaker) the setup network is whatever the phone is connected to.
 */
export type JoinTarget =
  | { mode: "auto"; target: ScanResult }
  | { mode: "manual"; target?: ScanResult };

/**
 * Binds to the setup network (`wifi.join`, or the manual prompt +
 * `bindToConnectedWifi`) and probes `/info` at `SETUP_IP`. Done when the
 * speaker answers and, when the setup SSID is known, its deviceID ends with
 * the SSID suffix.
 */
export async function join(
  env: StepEnv,
  signal: AbortSignal,
  request: JoinTarget,
): Promise<Result<Joined, JoinError>> {
  const { wifi, clock } = env.deps;
  let joined: Result<Link, JoinError>;
  if (request.mode === "auto") {
    const { ssid, bssid } = request.target;
    env.working("join", { kind: "joining", ssid });
    joined = await withTimeout(
      clock,
      JOIN_TIMEOUT_MS,
      signal,
      async (attempt) => wifi.join({ ssid, bssid }, attempt),
      () => new JoinTimeout({ ssid }),
    );
  } else {
    await env.ask(signal, { kind: "manualJoin" }, (answer) =>
      answer.kind === "manualJoin" && answer.connected ? true : undefined,
    );
    env.working("join", { kind: "connectingManually" });
    joined = await wifi.bindToConnectedWifi();
  }
  if (joined.isErr()) {
    return Result.err(joined.error);
  }
  const { ssid, bssid } = request.target ?? {
    ssid: (await wifi.currentNetwork()).ssid ?? "",
    bssid: "",
  };

  env.working("join", { kind: "probing", ssid });
  const info = await probeInfo(env.deps, signal, SETUP_IP, {
    budgetMs: JOIN_PROBE_BUDGET_MS,
    intervalMs: JOIN_PROBE_INTERVAL_MS,
  });
  if (info.isErr()) {
    return Result.err(new SpeakerUnreachable({ ssid, reason: "noAnswer" }));
  }
  const suffix = request.target ? setupSuffix(ssid) : null;
  if (suffix !== null && !info.value.deviceID.toUpperCase().endsWith(suffix)) {
    return Result.err(new SpeakerUnreachable({ ssid, reason: "wrongSpeaker" }));
  }
  const { deviceID, name, type } = info.value;
  return Result.ok({
    identity: { deviceID, name, type, ssid, bssid },
    link: joined.value,
  });
}
