import { Result } from "better-result";

import { retryWithin, withTimeout } from "../async";
import {
  CredentialsRejected,
  DeliveryFailed,
  LinkLost,
  SpeakerApiError,
  type SpeakerError,
  SpeakerResponseError,
  SpeakerTransportError,
} from "../errors";
import type { Credentials, SpeakerInterface } from "../ports";
import { probeInfo, SETUP_IP, speakerRequest, type StepEnv } from "./env";
import { JOIN_PROBE_BUDGET_MS, JOIN_PROBE_INTERVAL_MS } from "./join";

/** `addWirelessProfile` blocks while the speaker joins; slowest reply observed: 35 s. */
export const DELIVER_TIMEOUT_MS = 60_000;
/** `wlan0` had its address 4 s after the OK reply. */
export const NETWORK_INFO_BUDGET_MS = 10_000;
export const NETWORK_INFO_INTERVAL_MS = 1000;

/** `ApiError` name the speaker replies with when it could not join (wrong password or DHCP refused). */
export const CREDENTIALS_REJECTED_NAME = "WIFI_PROFILE_SETUP_FAILED";

export interface Delivered {
  /** The speaker's home-network address (`wlan0`), when it reported one. */
  homeIp?: string;
}

/**
 * Sends the credentials over the link; the reply is the verdict. A transport
 * error or timeout is not success: the step probes the speaker and accepts
 * only a `wlan0` on the requested SSID with an address.
 */
export async function deliver(
  env: StepEnv,
  signal: AbortSignal,
  credentials: Credentials,
): Promise<Result<Delivered, CredentialsRejected | DeliveryFailed | LinkLost>> {
  const { speaker, clock, log } = env.deps;
  const { ssid } = credentials;
  env.working("deliver", { kind: "delivering", ssid });
  const sent = await withTimeout(
    clock,
    DELIVER_TIMEOUT_MS,
    signal,
    async (request) => speaker.sendCredentials(SETUP_IP, credentials, request),
    () =>
      new SpeakerTransportError({
        message: `No reply within ${DELIVER_TIMEOUT_MS} ms`,
      }),
  );
  if (sent.isOk()) {
    log.event("deliver.reply", { result: "ok" });
    env.working("deliver", { kind: "confirming", ssid });
    const homeIp = await homeAddress(env, signal, ssid, "poll");
    log.event("deliver.homeIp", { found: homeIp !== undefined });
    return Result.ok(homeIp === undefined ? {} : { homeIp });
  }

  const error = sent.error;
  log.event("deliver.reply", { result: error.name });
  if (SpeakerApiError.is(error)) {
    log.event("deliver.apiError", {
      errorName: error.errorName,
      value: error.value,
    });
    return Result.err(
      error.errorName === CREDENTIALS_REJECTED_NAME
        ? new CredentialsRejected({ ssid })
        : new DeliveryFailed({
            ssid,
            message: `${error.errorName} (${error.value})`,
            cause: error,
          }),
    );
  }
  if (SpeakerResponseError.is(error)) {
    return Result.err(
      new DeliveryFailed({ ssid, message: error.message, cause: error }),
    );
  }
  return confirmAfterTransportError(env, signal, ssid, error);
}

async function confirmAfterTransportError(
  env: StepEnv,
  signal: AbortSignal,
  ssid: string,
  cause: SpeakerTransportError,
): Promise<Result<Delivered, DeliveryFailed | LinkLost>> {
  const { log } = env.deps;
  env.working("deliver", { kind: "confirming", ssid });
  const probe = await probeInfo(env.deps, signal, SETUP_IP, {
    budgetMs: JOIN_PROBE_BUDGET_MS,
    intervalMs: JOIN_PROBE_INTERVAL_MS,
  });
  if (probe.isErr()) {
    log.event("deliver.confirm", { result: "linkLost" });
    return Result.err(new LinkLost());
  }
  const homeIp = await homeAddress(env, signal, ssid, "firstReply");
  log.event("deliver.confirm", { joined: homeIp !== undefined });
  if (homeIp !== undefined) {
    return Result.ok({ homeIp });
  }
  return Result.err(
    new DeliveryFailed({
      ssid,
      message: "The speaker didn't confirm joining the network.",
      cause,
    }),
  );
}

function wlan0Address(
  interfaces: readonly SpeakerInterface[],
  ssid: string,
): string | undefined {
  const wlan0 = interfaces.find((entry) => entry.name === "wlan0");
  // `state` reads DISCONNECTED until setup mode ends; only ssid + address count.
  return wlan0?.ssid === ssid && wlan0.ipAddress ? wlan0.ipAddress : undefined;
}

/**
 * Reads `wlan0`'s address on `ssid` from `/networkInfo` over the link within
 * `NETWORK_INFO_BUDGET_MS`. `poll` retries until the address shows up;
 * `firstReply` retries only failed requests and lets the first reply decide.
 */
async function homeAddress(
  env: StepEnv,
  signal: AbortSignal,
  ssid: string,
  mode: "poll" | "firstReply",
): Promise<string | undefined> {
  const { speaker, clock } = env.deps;
  const reply = await retryWithin<string | undefined, SpeakerError>(
    clock,
    signal,
    { budgetMs: NETWORK_INFO_BUDGET_MS, intervalMs: NETWORK_INFO_INTERVAL_MS },
    async (attempt) => {
      const info = await speakerRequest(env.deps, attempt, async (request) =>
        speaker.networkInfo(SETUP_IP, request),
      );
      if (info.isErr()) {
        return info;
      }
      const address = wlan0Address(info.value.interfaces, ssid);
      if (address === undefined && mode === "poll") {
        return Result.err(
          new SpeakerResponseError({ message: "wlan0 has no address yet" }),
        );
      }
      return Result.ok(address);
    },
    (last) =>
      last ??
      new SpeakerTransportError({
        message: `No networkInfo within ${NETWORK_INFO_BUDGET_MS} ms`,
      }),
  );
  return reply.isOk() ? reply.value : undefined;
}
