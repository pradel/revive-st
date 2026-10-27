import { Result } from "better-result";

import { AbortedError, firstSettled, type Task } from "../async";
import { LinkLost } from "../errors";
import type { Clock, Link } from "../ports";

/** How long a lost link may stay lost before the step fails with `LinkLost`. */
export const LINK_RESTORE_MS = 15_000;

/**
 * Tracks one link from join until it is released. Steps between join and
 * leaveSetup run through `guard`, which fails with `LinkLost` once the link has
 * been lost for `LINK_RESTORE_MS` without being restored.
 */
export class LinkWatch {
  readonly #clock: Clock;
  readonly #unsubscribe: (() => void)[];
  readonly #waiters = new Set<() => void>();
  #lost = false;
  #lostAt = 0;

  constructor(link: Link, clock: Clock) {
    this.#clock = clock;
    this.#unsubscribe = [
      link.onLost(() => {
        if (!this.#lost) {
          this.#lost = true;
          this.#lostAt = clock.now();
          this.#notify();
        }
      }),
      link.onRestored(() => {
        if (this.#lost) {
          this.#lost = false;
          this.#notify();
        }
      }),
    ];
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
    this.#unsubscribe.length = 0;
  }

  /** Runs `task`; aborts it and returns `LinkLost` if the link stays lost too long. */
  async guard<Value, Failure>(
    signal: AbortSignal,
    task: Task<Result<Value, Failure>>,
  ): Promise<Result<Value, Failure | LinkLost>> {
    return firstSettled<Result<Value, Failure | LinkLost>>(signal, [
      task,
      async (watchSignal) => this.#lostForGood(watchSignal),
    ]);
  }

  async #lostForGood(signal: AbortSignal): Promise<Result<never, LinkLost>> {
    for (;;) {
      if (this.#lost) {
        const remaining = this.#lostAt + LINK_RESTORE_MS - this.#clock.now();
        if (remaining <= 0) {
          return Result.err(new LinkLost());
        }
        await firstSettled(signal, [
          async (wait) => this.#clock.sleep(remaining, wait),
          async (wait) => this.#nextChange(wait),
        ]);
      } else {
        await this.#nextChange(signal);
      }
    }
  }

  #notify(): void {
    const waiters = [...this.#waiters];
    this.#waiters.clear();
    for (const waiter of waiters) {
      waiter();
    }
  }

  async #nextChange(signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new AbortedError());
        return;
      }
      const onAbort = () => {
        this.#waiters.delete(waiter);
        reject(new AbortedError());
      };
      const waiter = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      this.#waiters.add(waiter);
      signal.addEventListener("abort", onAbort);
    });
  }
}
