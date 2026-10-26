import { validateCredentials } from "../credentials";
import type { Credentials } from "../ports";
import { homeNetworkCandidates } from "../scan";
import type { StepEnv } from "./env";

export interface CredentialsPromptOptions {
  /** SSID to preselect: the last submitted SSID, else the phone's home SSID. */
  suggested?: string;
  reason?: "rejected";
}

/**
 * Lists home-network candidates and waits for valid credentials. The `retry`
 * action rescans and republishes the prompt. Invalid answers are ignored (the
 * form validates with `validateCredentials` before submitting).
 */
export async function askCredentials(
  env: StepEnv,
  signal: AbortSignal,
  options: CredentialsPromptOptions,
): Promise<Credentials> {
  const { wifi, log } = env.deps;
  env.working("credentials", { kind: "loadingNetworks" });
  for (;;) {
    const { results } = await wifi.scan(signal);
    const networks = homeNetworkCandidates(results);
    const answer = await env.ask(
      signal,
      {
        kind: "credentials",
        networks,
        suggested: options.suggested,
        reason: options.reason,
      },
      (reply): Credentials | "refresh" | undefined => {
        if (reply.kind === "action" && reply.action === "retry") {
          return "refresh";
        }
        if (reply.kind !== "credentials") {
          return undefined;
        }
        const security = networks.find(
          (network) => network.ssid === reply.ssid,
        )?.security;
        const valid = validateCredentials(
          { ssid: reply.ssid, password: reply.password },
          security,
        );
        if (valid.isErr()) {
          log.event("credentials.invalid", { problem: valid.error.problem });
          return undefined;
        }
        return valid.value.credentials;
      },
    );
    if (answer !== "refresh") {
      return answer;
    }
  }
}
