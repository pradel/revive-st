import { Result } from "better-result";

import type { Clock } from "./ports";

/** Rejection used for every cancelled wait. Hermes has no reliable `DOMException`/`signal.reason`. */
export class AbortedError extends Error {
  constructor() {
    super("Aborted");
    this.name = "AbortError";
  }
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new AbortedError();
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export interface ChildController {
  readonly signal: AbortSignal;
  /** Aborts the child and detaches it from the parent. */
  dispose: () => void;
}

/** A controller aborted together with `parent` (no `AbortSignal.any` on Hermes). */
export function childController(parent: AbortSignal): ChildController {
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };
  if (parent.aborted) {
    controller.abort();
  } else {
    parent.addEventListener("abort", onAbort);
  }
  return {
    signal: controller.signal,
    dispose: () => {
      parent.removeEventListener("abort", onAbort);
      controller.abort();
    },
  };
}

/** Settles like `promise`, but rejects with `AbortedError` as soon as `signal` aborts. */
export async function abortable<Value>(
  promise: Promise<Value>,
  signal: AbortSignal,
): Promise<Value> {
  return new Promise<Value>((resolve, reject) => {
    const onAbort = () => {
      reject(new AbortedError());
    };
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort);
    }
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) {
          onAbort();
        } else {
          resolve(value);
        }
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) {
          onAbort();
        } else {
          reject(asError(error));
        }
      },
    );
  });
}

export interface Wakeup {
  /** Wakes the pending `wait`, or the next one if nobody is waiting. */
  notify: () => void;
  wait: (signal: AbortSignal) => Promise<void>;
}

/** A single-waiter edge trigger that never loses a notification. */
export function createWakeup(): Wakeup {
  let pending = false;
  let waiter: (() => void) | undefined;
  return {
    notify: () => {
      if (waiter) {
        const wake = waiter;
        waiter = undefined;
        wake();
      } else {
        pending = true;
      }
    },
    wait: async (signal) =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new AbortedError());
          return;
        }
        if (pending) {
          pending = false;
          resolve();
          return;
        }
        const onAbort = () => {
          waiter = undefined;
          reject(new AbortedError());
        };
        signal.addEventListener("abort", onAbort);
        waiter = () => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        };
      }),
  };
}

/** `clock.sleep` that rejects immediately when `signal` is already aborted. */
export async function sleep(
  clock: Clock,
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  await clock.sleep(ms, signal);
}

export type Task<Value> = (signal: AbortSignal) => Promise<Value>;

async function start<Value>(
  task: Task<Value>,
  signal: AbortSignal,
): Promise<Value> {
  return task(signal);
}

/** Children of `parent` for each task, released together once the race is decided. */
function raceControllers(parent: AbortSignal, count: number) {
  const children = Array.from({ length: count }, () => childController(parent));
  return {
    signals: children.map((child) => child.signal),
    dispose: () => {
      for (const child of children) {
        child.dispose();
      }
    },
  };
}

/**
 * Runs every task with its own child signal; the first one to settle (value or
 * rejection) decides the result and every other task is aborted. Rejects with
 * `AbortedError` when `parent` aborts first.
 */
export async function firstSettled<Value>(
  parent: AbortSignal,
  tasks: readonly Task<Value>[],
): Promise<Value> {
  return new Promise<Value>((resolve, reject) => {
    if (parent.aborted) {
      reject(new AbortedError());
      return;
    }
    let settled = false;
    const children = raceControllers(parent, tasks.length);
    const finish = () => {
      settled = true;
      parent.removeEventListener("abort", onParentAbort);
      children.dispose();
    };
    const onParentAbort = () => {
      if (!settled) {
        finish();
        reject(new AbortedError());
      }
    };
    parent.addEventListener("abort", onParentAbort);
    tasks.forEach((task, index) => {
      start(task, children.signals[index]).then(
        (value) => {
          if (!settled) {
            finish();
            resolve(value);
          }
        },
        (error: unknown) => {
          if (!settled) {
            finish();
            reject(parent.aborted ? new AbortedError() : asError(error));
          }
        },
      );
    });
  });
}

/**
 * Runs every task with its own child signal. The first `Ok` wins and every
 * other task is aborted; if all fail, the error of the task that finished last
 * is returned. A task that rejects (outside of an abort) rejects the race.
 * Aborting `parent` aborts every task and rejects with `AbortedError`.
 */
export async function raceCancel<Value, Failure>(
  parent: AbortSignal,
  tasks: readonly [
    Task<Result<Value, Failure>>,
    ...Task<Result<Value, Failure>>[],
  ],
): Promise<Result<Value, Failure>> {
  return new Promise<Result<Value, Failure>>((resolve, reject) => {
    if (parent.aborted) {
      reject(new AbortedError());
      return;
    }
    let settled = false;
    let failures = 0;
    const children = raceControllers(parent, tasks.length);
    const finish = () => {
      settled = true;
      parent.removeEventListener("abort", onParentAbort);
      children.dispose();
    };
    const onParentAbort = () => {
      if (!settled) {
        finish();
        reject(new AbortedError());
      }
    };
    parent.addEventListener("abort", onParentAbort);
    tasks.forEach((task, index) => {
      start(task, children.signals[index]).then(
        (result) => {
          if (settled) {
            return;
          }
          if (result.isOk()) {
            finish();
            resolve(result);
            return;
          }
          failures++;
          if (failures === tasks.length) {
            finish();
            resolve(result);
          }
        },
        (error: unknown) => {
          if (!settled) {
            finish();
            reject(parent.aborted ? new AbortedError() : asError(error));
          }
        },
      );
    });
  });
}

/** Runs `task`; after `ms` it is aborted and `Err(onTimeout())` is returned. */
export async function withTimeout<Value, Failure, Timeout>(
  clock: Clock,
  ms: number,
  parent: AbortSignal,
  task: Task<Result<Value, Failure>>,
  onTimeout: () => Timeout,
): Promise<Result<Value, Failure | Timeout>> {
  return firstSettled<Result<Value, Failure | Timeout>>(parent, [
    task,
    async (signal) => {
      await clock.sleep(ms, signal);
      return Result.err(onTimeout());
    },
  ]);
}

/**
 * Repeats `attempt` every `intervalMs` until it returns `Ok` or `budgetMs` has
 * passed; then returns `Err(onExhausted(lastError))`.
 */
export async function retryWithin<Value, Failure>(
  clock: Clock,
  parent: AbortSignal,
  options: { budgetMs: number; intervalMs: number },
  attempt: Task<Result<Value, Failure>>,
  onExhausted: (last: Failure | undefined) => Failure,
): Promise<Result<Value, Failure>> {
  let last: Failure | undefined;
  return withTimeout(
    clock,
    options.budgetMs,
    parent,
    async (signal): Promise<Result<Value, Failure>> => {
      for (;;) {
        const result = await attempt(signal);
        if (result.isOk()) {
          return result;
        }
        last = result.error;
        await sleep(clock, options.intervalMs, signal);
      }
    },
    () => onExhausted(last),
  );
}
