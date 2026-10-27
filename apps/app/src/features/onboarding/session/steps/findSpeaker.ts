import { sleep } from "../async";
import type { ScanResult } from "../ports";
import { setupNetworks } from "../scan";
import type { StepEnv } from "./env";

/** Android throttles app scans and the speaker was missed twice in a row. */
export const SCAN_INTERVAL_MS = 5000;

/**
 * Scans until a setup network shows up (stale results allowed; no dead end).
 * One speaker is used directly; several are offered in `chooseSpeaker`.
 */
export async function findSpeaker(
  env: StepEnv,
  signal: AbortSignal,
): Promise<ScanResult> {
  const { wifi, clock, log } = env.deps;
  for (let attempt = 1; ; attempt++) {
    env.working("findSpeaker", { kind: "scanning", attempt });
    const { results, fresh } = await wifi.scan(signal);
    const speakers = setupNetworks(results);
    log.event("findSpeaker.scan", {
      attempt,
      fresh,
      networks: results.length,
      speakers: speakers.length,
    });
    if (speakers.length === 1) {
      return speakers[0];
    }
    if (speakers.length > 1) {
      return env.ask(signal, { kind: "chooseSpeaker", speakers }, (answer) =>
        answer.kind === "chooseSpeaker"
          ? speakers.find((speaker) => speaker.bssid === answer.bssid)
          : undefined,
      );
    }
    await sleep(clock, SCAN_INTERVAL_MS, signal);
  }
}
