import { Result } from "better-result";
import { describe, expect, it } from "vite-plus/test";

import { AbortedError, raceCancel, sleep, withTimeout } from "./async";
import { flushPromises, ManualClock } from "./testing/fakes";

/** Resolves with `result` after `ms` of virtual time; rejects when aborted. */
async function after<Value>(
  clock: ManualClock,
  ms: number,
  signal: AbortSignal,
  result: Value,
): Promise<Value> {
  await clock.sleep(ms, signal);
  return result;
}

/** Records each task's signal so tests can see which ones were aborted. */
function signals() {
  const seen: AbortSignal[] = [];
  return {
    seen,
    track: (signal: AbortSignal) => {
      seen.push(signal);
      return signal;
    },
  };
}

describe("raceCancel", () => {
  it("returns the first success and aborts every loser", async () => {
    const clock = new ManualClock();
    const parent = new AbortController();
    const { seen, track } = signals();
    const race = raceCancel<string, string>(parent.signal, [
      async (signal) => after(clock, 100, track(signal), Result.ok("slow")),
      async (signal) => after(clock, 50, track(signal), Result.ok("fast")),
      async (signal) => after(clock, 10, track(signal), Result.err("failed")),
      async (signal) => new Promise(() => track(signal)),
    ]);
    await clock.advance(50);

    const result = await race;

    expect(result.isOk() && result.value).toBe("fast");
    expect(seen.map((signal) => signal.aborted)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(clock.pendingTimers).toBe(0);
  });

  it("returns the error of the task that finished last when all fail", async () => {
    const clock = new ManualClock();
    const parent = new AbortController();
    const race = raceCancel<string, string>(parent.signal, [
      async (signal) => after(clock, 10, signal, Result.err("first")),
      async (signal) => after(clock, 30, signal, Result.err("last")),
      async (signal) => after(clock, 20, signal, Result.err("middle")),
    ]);
    await clock.advance(30);

    const result = await race;

    expect(result.isErr() && result.error).toBe("last");
  });

  it("aborts every task when the parent aborts", async () => {
    const clock = new ManualClock();
    const parent = new AbortController();
    const { seen, track } = signals();
    const race = raceCancel<string, string>(parent.signal, [
      async (signal) => after(clock, 100, track(signal), Result.ok("a")),
      async (signal) => after(clock, 200, track(signal), Result.ok("b")),
    ]);
    const outcome = race.then(
      () => "settled",
      (error: unknown) => error,
    );
    await clock.advance(10);

    parent.abort();

    expect(await outcome).toBeInstanceOf(AbortedError);
    expect(seen.every((signal) => signal.aborted)).toBe(true);
    expect(clock.pendingTimers).toBe(0);
  });

  it("ignores a task that settles after the race is decided", async () => {
    const clock = new ManualClock();
    const parent = new AbortController();
    let lateSettled = false;
    const race = raceCancel<string, string>(parent.signal, [
      async (signal) => after(clock, 10, signal, Result.ok("winner")),
      // Ignores its signal entirely.
      async () =>
        new Promise((resolve) => {
          clock.schedule(50, () => {
            lateSettled = true;
            resolve(Result.ok("late"));
          });
        }),
      async () =>
        new Promise((_resolve, reject) => {
          clock.schedule(60, () => {
            reject(new Error("late failure"));
          });
        }),
    ]);
    await clock.advance(100);

    const result = await race;

    expect(lateSettled).toBe(true);
    expect(result.isOk() && result.value).toBe("winner");
  });
});

describe("withTimeout", () => {
  it("aborts the task and returns the timeout error", async () => {
    const clock = new ManualClock();
    const parent = new AbortController();
    let taskSignal: AbortSignal | undefined;
    const pending = withTimeout(
      clock,
      1000,
      parent.signal,
      async (signal) => {
        taskSignal = signal;
        return after(clock, 5000, signal, Result.ok("done"));
      },
      () => "timeout",
    );
    await clock.advance(1000);

    const result = await pending;

    expect(result.isErr() && result.error).toBe("timeout");
    expect(taskSignal?.aborted).toBe(true);
    expect(clock.pendingTimers).toBe(0);
  });
});

describe("sleep", () => {
  it("resolves only once the clock has advanced by the delay", async () => {
    const clock = new ManualClock();
    let woke = false;
    const sleeping = sleep(clock, 1000, new AbortController().signal).then(
      () => {
        woke = true;
      },
    );
    await clock.advance(999);
    expect(woke).toBe(false);

    await clock.advance(1);
    await sleeping;

    expect(woke).toBe(true);
    expect(clock.pendingTimers).toBe(0);
  });

  it("rejects on abort and leaves no pending timer", async () => {
    const clock = new ManualClock();
    const controller = new AbortController();
    const sleeping = sleep(clock, 1000, controller.signal);
    const outcome = sleeping.then(
      () => "resolved",
      (error: unknown) => error,
    );
    await flushPromises();
    expect(clock.pendingTimers).toBe(1);

    controller.abort();

    expect(await outcome).toBeInstanceOf(AbortedError);
    expect(clock.pendingTimers).toBe(0);
  });

  it("rejects immediately when already aborted", async () => {
    const clock = new ManualClock();
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(clock, 1000, controller.signal)).rejects.toBeInstanceOf(
      AbortedError,
    );
    expect(clock.pendingTimers).toBe(0);
  });
});
