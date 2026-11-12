import type { Result } from "better-result";
import {
  ApiError,
  type BoseApiError,
  NetworkError,
  type NewGroup,
  type SpeakerGroup,
} from "bose-api-speaker-client";

import { sleep, type Task, withTimeout } from "../onboarding/session/async";
import type { Clock, Log } from "../onboarding/session/ports";
import type { ServerCheck } from "../server/server-version";

/** How long pairing may take, from the server check to both speakers confirming. */
export const PAIR_BUDGET_MS = 45_000;
const SERVER_CHECK_TIMEOUT_MS = 8000;
/** `/addGroup` answered within a second on hardware; the master waits on our server meanwhile. */
const ADD_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 4000;
/** Waits before each check that both speakers report the pair; the last repeats. */
export const CONFIRM_WAITS_MS = [1000, 4000, 10_000] as const;

/** `/addGroup` while one of the speakers is in a pair. */
export const GROUP_ALREADY_EXISTS = 5510;
/** `/addGroup` when the master couldn't store the pair on its server. */
export const GROUP_NOT_STORED = 5580;

/** One of the two speakers, as the speaker list knows it. */
export interface PairMember {
  deviceID: string;
  name: string;
  host: string;
  port: number;
}

/** The pair to make: the left speaker is the master. */
export interface PairTarget {
  name: string;
  left: PairMember;
  right: PairMember;
}

export interface PairDeps {
  /** Our server's `GET /`; `Err` when it can't be reached. */
  checkServer: (signal: AbortSignal) => Promise<Result<ServerCheck, Error>>;
  speaker: {
    getGroup: (
      member: PairMember,
      signal: AbortSignal,
    ) => Promise<Result<SpeakerGroup | null, BoseApiError>>;
    addGroup: (
      member: PairMember,
      group: NewGroup,
      signal: AbortSignal,
    ) => Promise<Result<SpeakerGroup, BoseApiError>>;
    removeGroup: (
      member: PairMember,
      signal: AbortSignal,
    ) => Promise<Result<{ peerUnreachable: boolean }, BoseApiError>>;
  };
  clock: Clock;
  log: Log;
}

export type PairStepId = "check" | "pair" | "confirm";

export const PAIR_STEP_IDS: readonly PairStepId[] = [
  "check",
  "pair",
  "confirm",
];

export type PairError =
  | { kind: "serverUnreachable" }
  | {
      kind: "serverUnsupported";
      check: Exclude<ServerCheck, { kind: "supported" }>;
    }
  /** 5580: the master couldn't store the pair on our server. */
  | { kind: "serverRejected" }
  /** 5510 again after the stale pair was removed. */
  | { kind: "alreadyPaired" }
  | { kind: "speakerFailed" }
  /** The speakers didn't both report the pair in time; `undone` once what formed was removed. */
  | { kind: "notConfirmed"; undone: boolean };

export type PairView =
  | {
      kind: "working";
      step: PairStepId;
      /** When the run started: the budget counts from it. */
      startedAt: number;
    }
  | { kind: "failed"; step: PairStepId; error: PairError }
  | { kind: "done"; group: SpeakerGroup };

export interface PairSession {
  subscribe: (listener: () => void) => () => void;
  getView: () => PairView;
  /** Starts the run; does nothing once started. */
  start: () => void;
  /** Runs it all again, with a new budget, once it failed. */
  retry: () => void;
  /** Stops the run. What the speakers were sent stays. */
  cancel: () => Promise<void>;
}

const hasErrorValue = (error: BoseApiError, value: number): boolean =>
  error instanceof ApiError &&
  error.errors.some((entry) => entry.value === value);

type Outcome = { kind: "done"; group: SpeakerGroup } | PairFailure;
interface PairFailure {
  kind: "failed";
  step: PairStepId;
  error: PairError;
}

const failed = (step: PairStepId, error: PairError): PairFailure => ({
  kind: "failed",
  step,
  error,
});

/**
 * Pairs two SoundTouch 10s: checks our server stores pairs, sends
 * `/addGroup` to the left speaker (the master) only, then waits for both to
 * report the pair. A pair left over from before (5510) is removed and the
 * pair tried once more; a pair only one speaker reports in time is undone.
 */
export function createPairSession(
  deps: PairDeps,
  target: PairTarget,
): PairSession {
  const { clock, log } = deps;
  const controller = new AbortController();
  const { signal } = controller;
  const listeners = new Set<() => void>();
  let view: PairView = {
    kind: "working",
    step: "check",
    startedAt: clock.now(),
  };
  let running: Promise<void> | undefined;

  const publish = (next: PairView) => {
    if (signal.aborted) {
      return;
    }
    view = next;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const request = async <Value>(
    ms: number,
    task: Task<Result<Value, BoseApiError>>,
  ): Promise<Result<Value, BoseApiError>> =>
    withTimeout(
      clock,
      ms,
      signal,
      task,
      () => new NetworkError({ message: "Timed out" }),
    );

  const { left, right } = target;
  const group: NewGroup = {
    name: target.name,
    masterDeviceId: left.deviceID,
    roles: [
      { deviceId: left.deviceID, role: "LEFT", ipAddress: left.host },
      { deviceId: right.deviceID, role: "RIGHT", ipAddress: right.host },
    ],
  };

  const readGroup = async (member: PairMember) =>
    request(REQUEST_TIMEOUT_MS, async (requestSignal) =>
      deps.speaker.getGroup(member, requestSignal),
    );

  const removeGroup = async (member: PairMember) => {
    log.event("pair.remove", { deviceID: member.deviceID });
    return request(REQUEST_TIMEOUT_MS, async (requestSignal) =>
      deps.speaker.removeGroup(member, requestSignal),
    );
  };

  const addGroup = async () =>
    request(ADD_TIMEOUT_MS, async (requestSignal) =>
      deps.speaker.addGroup(left, group, requestSignal),
    );

  /** This pair, formed and confirmed by the speaker. */
  const formed = (reported: SpeakerGroup | null): reported is SpeakerGroup =>
    reported?.status === "GROUP_OK" &&
    reported.masterDeviceId === left.deviceID &&
    reported.roles.some((role) => role.deviceId === right.deviceID);

  const checkServer = async (): Promise<PairFailure | undefined> => {
    const checked = await withTimeout(
      clock,
      SERVER_CHECK_TIMEOUT_MS,
      signal,
      deps.checkServer,
      () => new Error("Timed out"),
    );
    if (checked.isErr()) {
      log.event("pair.server", { reached: false });
      return failed("check", { kind: "serverUnreachable" });
    }
    const check = checked.value;
    log.event("pair.server", { reached: true, check: check.kind });
    return check.kind === "supported"
      ? undefined
      : failed("check", { kind: "serverUnsupported", check });
  };

  /** A pair of only these two speakers, which a new one may replace. */
  const ofThesePair = (reported: SpeakerGroup) =>
    reported.roles.every(
      (role) =>
        role.deviceId === left.deviceID || role.deviceId === right.deviceID,
    );

  const pair = async (): Promise<PairFailure | undefined> => {
    let added = await addGroup();
    if (added.isErr() && hasErrorValue(added.error, GROUP_ALREADY_EXISTS)) {
      // A pair of these two our server doesn't know (dropped without telling
      // it, a factory reset): removing it from either speaker clears both.
      // A pair with another speaker is kept, and the run fails.
      log.event("pair.stale");
      const reads = await Promise.all([readGroup(left), readGroup(right)]);
      const stale = [left, right].filter((_member, index) => {
        const read = reads[index];
        return read?.isOk() && read.value !== null && ofThesePair(read.value);
      });
      const other = reads.some(
        (read) =>
          read.isOk() && read.value !== null && !ofThesePair(read.value),
      );
      if (other || stale.length === 0) {
        return failed("pair", { kind: "alreadyPaired" });
      }
      for (const member of stale) {
        await removeGroup(member);
      }
      added = await addGroup();
    }
    if (added.isOk()) {
      return undefined;
    }
    const { error } = added;
    log.event("pair.addFailed", { error: error.name });
    if (hasErrorValue(error, GROUP_ALREADY_EXISTS)) {
      return failed("pair", { kind: "alreadyPaired" });
    }
    if (hasErrorValue(error, GROUP_NOT_STORED)) {
      return failed("pair", { kind: "serverRejected" });
    }
    return failed("pair", { kind: "speakerFailed" });
  };

  const confirm = async (deadline: number): Promise<Outcome> => {
    let reports: (SpeakerGroup | null)[] = [null, null];
    for (let round = 0; ; round += 1) {
      const wait = CONFIRM_WAITS_MS[round] ?? CONFIRM_WAITS_MS[2];
      if (clock.now() + wait > deadline) {
        break;
      }
      await sleep(clock, wait, signal);
      const reads = await Promise.all([readGroup(left), readGroup(right)]);
      // A speaker that didn't answer keeps what it said before.
      const previous = reports;
      reports = reads.map((read, index) =>
        read.isOk() ? read.value : (previous[index] ?? null),
      );
      const [master = null, partner = null] = reports;
      log.event("pair.confirm", {
        round,
        left: master?.status ?? "none",
        right: partner?.status ?? "none",
      });
      if (formed(master) && formed(partner) && master.id === partner.id) {
        return { kind: "done", group: master };
      }
    }
    // What formed is undone, so neither speaker is left half paired; the
    // master, which accepted the pair, when neither answered.
    const reporting =
      [left, right].find((_member, index) => reports[index] !== null) ?? left;
    const undone = (await removeGroup(reporting)).isOk();
    return failed("confirm", { kind: "notConfirmed", undone });
  };

  const attempt = async (): Promise<Outcome> => {
    const startedAt = clock.now();
    const deadline = startedAt + PAIR_BUDGET_MS;
    publish({ kind: "working", step: "check", startedAt });
    const serverProblem = await checkServer();
    if (serverProblem) {
      return serverProblem;
    }
    publish({ kind: "working", step: "pair", startedAt });
    const pairProblem = await pair();
    if (pairProblem) {
      return pairProblem;
    }
    publish({ kind: "working", step: "confirm", startedAt });
    return confirm(deadline);
  };

  const run = async () => {
    try {
      log.event("pair.start");
      const outcome = await attempt();
      if (outcome.kind === "done") {
        log.event("pair.done");
        publish({ kind: "done", group: outcome.group });
      } else {
        publish({ kind: "failed", step: outcome.step, error: outcome.error });
      }
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      log.event("pair.unexpected", {
        message: error instanceof Error ? error.message : String(error),
      });
      publish({
        kind: "failed",
        step: view.kind === "working" ? view.step : "check",
        error: { kind: "speakerFailed" },
      });
    }
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getView: () => view,
    start: () => {
      if (running || signal.aborted) {
        return;
      }
      running = run();
    },
    retry: () => {
      if (view.kind !== "failed" || signal.aborted) {
        return;
      }
      running = run();
    },
    cancel: async () => {
      controller.abort();
      await running;
    },
  };
}
