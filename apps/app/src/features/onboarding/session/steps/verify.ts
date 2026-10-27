import { Result } from "better-result";

import { raceCancel, sleep, withTimeout } from "../async";
import { NotVerified } from "../errors";
import type { SpeakerIdentity } from "../types";
import { probeInfo, sameDevice, speakerRequest, type StepEnv } from "./env";

/** The speaker answered on its home address before `addWirelessProfile` returned. */
export const VERIFY_TIMEOUT_MS = 60_000;
/** The API pauses for a few seconds after `SETUP_LEAVE`; keep polling. */
export const VERIFY_POLL_INTERVAL_MS = 2000;
/** Setup network gone and `SETUP_INACTIVE` within 20 s of `SETUP_LEAVE`. */
export const LEAVE_SETTLE_MS = 20_000;
/** How long an address typed by the user is probed. */
export const ENTER_IP_BUDGET_MS = 10_000;
/** The discovery adapter restarts its browse this often. */
export const BROWSE_RESTART_MS = 30_000;

export interface VerifyTarget {
  identity: SpeakerIdentity;
  /** `wlan0` address read in deliver. */
  homeIp?: string;
  /** Address entered by the user (`enterIp`): only this host is checked. */
  ip?: string;
}

/**
 * Done when a host on the home network reports `/info.deviceID ===
 * identity.deviceID`. Races polling `homeIp` against mDNS (TXT `MAC` match,
 * confirmed by `/info`). Then ends setup mode over the home network if the
 * speaker is still in it.
 */
export async function verify(
  env: StepEnv,
  signal: AbortSignal,
  target: VerifyTarget,
): Promise<Result<{ host: string }, NotVerified>> {
  const { clock, discovery, log } = env.deps;
  const { deviceID } = target.identity;
  const { homeIp, ip } = target;
  env.working("verify", { kind: "verifying", deviceID, ip });

  const pollHost = async (
    host: string,
    pollSignal: AbortSignal,
  ): Promise<Result<string, NotVerified>> => {
    for (;;) {
      const info = await speakerRequest(env.deps, pollSignal, async (request) =>
        env.deps.speaker.info(host, request),
      );
      if (info.isOk() && sameDevice(info.value.deviceID, deviceID)) {
        return Result.ok(host);
      }
      await sleep(clock, VERIFY_POLL_INTERVAL_MS, pollSignal);
    }
  };

  let found: Result<string, NotVerified>;
  if (ip === undefined) {
    found = await withTimeout(
      clock,
      VERIFY_TIMEOUT_MS,
      signal,
      async (raceSignal) =>
        raceCancel<string, NotVerified>(raceSignal, [
          async (pollSignal) =>
            homeIp === undefined
              ? Result.err(new NotVerified({ deviceID }))
              : pollHost(homeIp, pollSignal),
          async (browseSignal) => {
            for await (const service of discovery.browse(browseSignal)) {
              if (service.mac !== null && sameDevice(service.mac, deviceID)) {
                log.event("verify.mdns", { matched: true });
                return pollHost(service.host, browseSignal);
              }
              log.event("verify.mdns", { matched: false });
            }
            return Result.err(new NotVerified({ deviceID }));
          },
        ]),
      () => new NotVerified({ deviceID }),
    );
  } else {
    const info = await probeInfo(env.deps, signal, ip, {
      budgetMs: ENTER_IP_BUDGET_MS,
      intervalMs: VERIFY_POLL_INTERVAL_MS,
    });
    found =
      info.isOk() && sameDevice(info.value.deviceID, deviceID)
        ? Result.ok(ip)
        : Result.err(new NotVerified({ deviceID, ip }));
  }
  if (found.isErr()) {
    log.event("verify.failed", { enteredIp: ip !== undefined });
    return Result.err(found.error);
  }
  const host = found.value;
  log.event("verify.found", { viaHomeIp: host === homeIp });
  await endSetupMode(env, signal, host);
  return Result.ok({ host });
}

/** Sends `SETUP_LEAVE` to `host` if it still reports `SETUP_AP_OOB`; failures are only logged. */
async function endSetupMode(
  env: StepEnv,
  signal: AbortSignal,
  host: string,
): Promise<void> {
  const { speaker, clock, log } = env.deps;
  const setupState = async (requestSignal: AbortSignal) =>
    speakerRequest(env.deps, requestSignal, async (request) =>
      speaker.setupState(host, request),
    );
  const outcome = await withTimeout(
    clock,
    LEAVE_SETTLE_MS,
    signal,
    async (settleSignal): Promise<Result<string, never>> => {
      let state = await setupState(settleSignal);
      while (state.isErr()) {
        await sleep(clock, VERIFY_POLL_INTERVAL_MS, settleSignal);
        state = await setupState(settleSignal);
      }
      if (state.value.state !== "SETUP_AP_OOB") {
        return Result.ok("notInSetup");
      }
      const left = await speakerRequest(
        env.deps,
        settleSignal,
        async (request) => speaker.leaveSetup(host, request),
      );
      log.event("verify.leaveSetup", {
        result: left.isOk() ? "ok" : left.error.name,
      });
      for (;;) {
        await sleep(clock, VERIFY_POLL_INTERVAL_MS, settleSignal);
        state = await setupState(settleSignal);
        if (state.isOk() && state.value.state === "SETUP_INACTIVE") {
          return Result.ok("left");
        }
      }
    },
    () => "timeout",
  );
  log.event("verify.setupMode", {
    result: outcome.isOk() ? outcome.value : outcome.error,
  });
}
