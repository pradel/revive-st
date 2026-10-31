import type { Result } from "better-result";

import {
  AbortedError,
  abortable,
  childController,
  throwIfAborted,
} from "../../onboarding/session/async";
import {
  type ConfigureError,
  recoveryActions,
  UnexpectedError,
} from "./errors";
import type { ConfigureDeps, ConsoleConnection, PortFailure } from "./ports";
import {
  awaitRestart,
  closeConsole,
  connect,
  prepare,
  restart,
  type RunContext,
  type StepEnv,
  verify,
} from "./steps";
import type {
  ConfigureSession,
  ConfigureTarget,
  ConfigureView,
  RecoveryAction,
  StepId,
} from "./types";

/** Where the run loop goes next; recovery actions re-enter one of these. */
type Entry =
  | { step: "prepare" }
  | { step: "connect" }
  | { step: "restart" }
  | { step: "awaitRestart"; skipShutdown: boolean }
  | { step: "verify" };

type Outcome =
  | { kind: "next"; entry: Entry }
  | { kind: "done"; serverConfirmed: boolean }
  | { kind: "failed"; error: ConfigureError };

const next = (entry: Entry): Outcome => ({ kind: "next", entry });

const STEP_OF_ENTRY: Record<Entry["step"], StepId> = {
  prepare: "prepare",
  connect: "connect",
  restart: "restart",
  awaitRestart: "restart",
  verify: "verify",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unreachable(value: never): never {
  throw new Error(`Unhandled value ${JSON.stringify(value)}`);
}
/**
 * Wraps every port so that, once `signal` aborts, pending calls reject with
 * `AbortedError`, new calls are refused and logging stops. A console
 * connection that opens after the abort is closed.
 */
function guardDeps(raw: ConfigureDeps, signal: AbortSignal): ConfigureDeps {
  const call = async <Value>(start: () => Promise<Value>): Promise<Value> => {
    throwIfAborted(signal);
    return abortable(start(), signal);
  };
  const { speaker, console, server, discovery, clock, log } = raw;
  return {
    speaker: {
      info: async (host, requestSignal) =>
        call(async () => speaker.info(host, requestSignal)),
      presets: async (host, requestSignal) =>
        call(async () => speaker.presets(host, requestSignal)),
      setMargeAccount: async (host, accountId, requestSignal) =>
        call(async () =>
          speaker.setMargeAccount(host, accountId, requestSignal),
        ),
      sourcesUpdated: async (host, deviceID, requestSignal) =>
        call(async () => speaker.sourcesUpdated(host, deviceID, requestSignal)),
    },
    console: {
      open: async (host) => {
        throwIfAborted(signal);
        const pending: Promise<Result<ConsoleConnection, PortFailure>> =
          console.open(host);
        void pending.then((opened) => {
          if (signal.aborted && opened.isOk()) {
            opened.value.close();
          }
        });
        return abortable(pending, signal);
      },
    },
    server: {
      origin: () => server.origin(),
      householdAccount: async (speakerAccount, otherSpeakers) =>
        call(async () =>
          server.householdAccount(speakerAccount, otherSpeakers),
        ),
      savePresets: async (accountId, deviceID, presets, requestSignal) =>
        call(async () =>
          server.savePresets(accountId, deviceID, presets, requestSignal),
        ),
      lastContact: async (deviceID, requestSignal) =>
        call(async () => server.lastContact(deviceID, requestSignal)),
    },
    discovery: {
      browse: (browseSignal) => ({
        [Symbol.asyncIterator]: () => {
          throwIfAborted(signal);
          const services = discovery.browse(browseSignal);
          const iterator = services[Symbol.asyncIterator]();
          return {
            next: async () => call(async () => iterator.next()),
            return: async () => {
              if (!signal.aborted) {
                await iterator.return?.();
              }
              return { done: true, value: undefined };
            },
          };
        },
      }),
    },
    clock,
    log: {
      event: (name, data) => {
        if (!signal.aborted) {
          log.event(name, data);
        }
      },
    },
  };
}

/**
 * Sets a speaker up for our server: saves its presets, writes the server
 * addresses over its console, pairs it, restarts it and checks the result.
 * React only renders `getView()`; recovery actions come back through `act`.
 */
export function createConfigureSession(
  rawDeps: ConfigureDeps,
  target: ConfigureTarget,
): ConfigureSession {
  const controller = new AbortController();
  const { signal } = controller;
  const deps = guardDeps(rawDeps, signal);
  const { clock, log } = deps;
  const listeners = new Set<() => void>();
  let view: ConfigureView = {
    kind: "working",
    step: "prepare",
    detail: { kind: "checkingSpeaker" },
    startedAt: clock.now(),
  };
  let accept: ((action: RecoveryAction) => boolean) | undefined;
  let running: Promise<void> | undefined;
  let cancelling: Promise<void> | undefined;

  const ctx: RunContext = {
    target,
    host: target.host,
    pairing: false,
  };

  const publish = (nextView: ConfigureView) => {
    if (signal.aborted) {
      return;
    }
    view = nextView;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const env: StepEnv = {
    deps,
    working: (step, detail) => {
      const startedAt =
        view.kind === "working" && view.step === step
          ? view.startedAt
          : clock.now();
      publish({ kind: "working", step, detail, startedAt });
    },
  };

  const runStep = async (entry: Entry): Promise<Outcome> => {
    switch (entry.step) {
      case "prepare": {
        const prepared = await prepare(env, signal, ctx);
        return prepared.isErr()
          ? { kind: "failed", error: prepared.error }
          : next({ step: "connect" });
      }
      case "connect": {
        const connected = await connect(env, signal, ctx);
        return connected.isErr()
          ? { kind: "failed", error: connected.error }
          : next({ step: "restart" });
      }
      case "restart": {
        const restarted = await restart(env, signal, ctx);
        return restarted.isErr()
          ? { kind: "failed", error: restarted.error }
          : next({ step: "awaitRestart", skipShutdown: false });
      }
      case "awaitRestart": {
        const back = await awaitRestart(env, signal, ctx, entry);
        return back.isErr()
          ? { kind: "failed", error: back.error }
          : next({ step: "verify" });
      }
      case "verify": {
        const verified = await verify(env, signal, ctx);
        return verified.isErr()
          ? { kind: "failed", error: verified.error }
          : { kind: "done", serverConfirmed: verified.value.serverConfirmed };
      }
      default: {
        return unreachable(entry);
      }
    }
  };

  const entryFor = (action: RecoveryAction): Entry =>
    action === "retry"
      ? { step: "prepare" }
      : { step: "awaitRestart", skipShutdown: true };

  /** Shows the failed view until the user picks one of its actions. */
  const recover = async (
    error: ConfigureError,
    failedEntry: Entry,
  ): Promise<Entry> => {
    closeConsole(ctx);
    const actions = recoveryActions(error);
    log.event("step.failed", { step: failedEntry.step, error: error.name });
    publish({
      kind: "failed",
      step: STEP_OF_ENTRY[failedEntry.step],
      error,
      actions,
    });
    const action = await new Promise<RecoveryAction>((resolve, reject) => {
      const waiting = childController(signal);
      waiting.signal.addEventListener("abort", () => {
        reject(new AbortedError());
      });
      accept = (picked) => {
        if (!actions.includes(picked)) {
          return false;
        }
        accept = undefined;
        resolve(picked);
        waiting.dispose();
        return true;
      };
    });
    log.event("action", { action });
    return entryFor(action);
  };

  const run = async () => {
    let entry: Entry = { step: "prepare" };
    try {
      for (;;) {
        let outcome: Outcome;
        try {
          log.event("step", { step: entry.step });
          outcome = await runStep(entry);
        } catch (error) {
          if (signal.aborted) {
            return;
          }
          outcome = {
            kind: "failed",
            error: new UnexpectedError({
              step: STEP_OF_ENTRY[entry.step],
              message: errorMessage(error),
            }),
          };
        }
        if (outcome.kind === "done") {
          log.event("done", { serverConfirmed: outcome.serverConfirmed });
          publish({
            kind: "done",
            host: ctx.host,
            serverConfirmed: outcome.serverConfirmed,
          });
          return;
        }
        entry =
          outcome.kind === "next"
            ? outcome.entry
            : await recover(outcome.error, entry);
      }
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    } finally {
      closeConsole(ctx);
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
    act: (action) => {
      if (!signal.aborted) {
        accept?.(action);
      }
    },
    cancel: async () => {
      cancelling ??= (async () => {
        if (!signal.aborted) {
          log.event("cancel", { view: view.kind });
          controller.abort();
        }
        closeConsole(ctx);
        await running;
      })();
      return cancelling;
    },
  };
}
