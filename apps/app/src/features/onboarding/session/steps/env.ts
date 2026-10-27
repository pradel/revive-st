import type { Result } from "better-result";

import { retryWithin, type Task, withTimeout } from "../async";
import { type SpeakerError, SpeakerTransportError } from "../errors";
import type { SetupDeps, SpeakerInfo } from "../ports";
import type { Prompt, PromptAnswer, StepId, WorkingDetail } from "../types";

/** The speaker's fixed address on its setup network. */
export const SETUP_IP = "192.0.2.1";

/** Per-request timeout for speaker probes (3 of 45 link probes needed > 1.5 s). */
export const PROBE_TIMEOUT_MS = 2000;

/** What a step may do besides calling ports. */
export interface StepEnv {
  /** Ports; every call rejects with `AbortedError` once the session is cancelled. */
  readonly deps: SetupDeps;
  /** Publishes a `working` view. */
  working: (step: StepId, detail: WorkingDetail) => void;
  /**
   * Routes answers to `accept` until `signal` aborts or another listener takes
   * over. `accept` returns `true` when it consumed the answer.
   */
  listen: (
    signal: AbortSignal,
    accept: (answer: PromptAnswer) => boolean,
  ) => void;
  /** Publishes `prompt` and resolves with the first answer `accept` maps to a value. */
  ask: <Answer>(
    signal: AbortSignal,
    prompt: Prompt,
    accept: (answer: PromptAnswer) => Answer | undefined,
  ) => Promise<Answer>;
}

/** One speaker request bounded by `PROBE_TIMEOUT_MS`. */
export async function speakerRequest<Reply>(
  deps: SetupDeps,
  signal: AbortSignal,
  call: Task<Result<Reply, SpeakerError>>,
): Promise<Result<Reply, SpeakerError>> {
  return withTimeout(
    deps.clock,
    PROBE_TIMEOUT_MS,
    signal,
    call,
    () =>
      new SpeakerTransportError({
        message: `No reply within ${PROBE_TIMEOUT_MS} ms`,
      }),
  );
}

/** Polls `/info` at `ip` every `intervalMs` until it answers or `budgetMs` passes. */
export async function probeInfo(
  deps: SetupDeps,
  signal: AbortSignal,
  ip: string,
  options: { budgetMs: number; intervalMs: number },
): Promise<Result<SpeakerInfo, SpeakerError>> {
  return retryWithin(
    deps.clock,
    signal,
    options,
    async (attempt) =>
      speakerRequest(deps, attempt, async (request) =>
        deps.speaker.info(ip, request),
      ),
    (last) =>
      last ??
      new SpeakerTransportError({
        message: `No answer within ${options.budgetMs} ms`,
      }),
  );
}

/** deviceIDs and TXT `MAC` records compare without separators or case. */
export function sameDevice(a: string, b: string): boolean {
  const normalise = (id: string) =>
    id.replaceAll(/[^0-9a-z]/gi, "").toUpperCase();
  return normalise(a) === normalise(b);
}
