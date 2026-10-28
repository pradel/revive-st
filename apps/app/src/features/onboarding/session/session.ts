import { Result } from "better-result";

import {
  AbortedError,
  abortable,
  childController,
  throwIfAborted,
} from "./async";
import {
  HomeWifiNotRestored,
  LinkLost,
  recoveryActions,
  type SetupError,
  UnexpectedError,
} from "./errors";
import type { Credentials, ScanResult, SetupDeps } from "./ports";
import { askCredentials } from "./steps/credentials";
import { deliver } from "./steps/deliver";
import type { StepEnv } from "./steps/env";
import { findSpeaker } from "./steps/findSpeaker";
import { join } from "./steps/join";
import { leaveSetup } from "./steps/leaveSetup";
import { LinkWatch } from "./steps/link";
import { nameSpeaker } from "./steps/name";
import { preflight } from "./steps/preflight";
import { rejoinHome } from "./steps/rejoinHome";
import { verify } from "./steps/verify";
import type {
  PromptAnswer,
  RecoveryAction,
  SetupSession,
  SetupView,
  SpeakerIdentity,
} from "./types";

/** Where the run loop goes next; recovery actions re-enter one of these. */
type Entry =
  | { step: "preflight"; request: boolean; rationale: boolean }
  | { step: "findSpeaker" }
  | { step: "join"; mode: "auto" | "manual" }
  | { step: "credentials"; reason?: "rejected" }
  | { step: "deliver" }
  | { step: "leaveSetup" }
  | { step: "rejoinHome" }
  | { step: "verify"; ip?: string }
  | { step: "name"; host: string };

type Outcome =
  | { kind: "next"; entry: Entry }
  | {
      kind: "done";
      speaker: SpeakerIdentity;
      host: string;
      renameFailed: boolean;
    }
  | { kind: "failed"; error: SetupError };

/** Survives recovery actions; `startOver` clears everything but `homeSsid`. */
interface Context {
  homeSsid: string | null;
  /** Unset on the manual path when scanning never found the speaker. */
  target?: ScanResult;
  identity?: SpeakerIdentity;
  /** In memory only: never published or logged. */
  credentials?: Credentials;
  homeIp?: string;
}

const next = (entry: Entry): Outcome => ({ kind: "next", entry });
const failed = (error: SetupError): Outcome => ({ kind: "failed", error });

function unreachable(value: never): never {
  throw new Error(`Unhandled value ${JSON.stringify(value)}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wraps every port so that, once `signal` aborts, pending calls reject with
 * `AbortedError`, new calls are refused, callbacks stop and logging stops.
 */
function guardDeps(raw: SetupDeps, signal: AbortSignal): SetupDeps {
  const call = async <Value>(start: () => Promise<Value>): Promise<Value> => {
    throwIfAborted(signal);
    return abortable(start(), signal);
  };
  const { wifi, speaker, discovery, permissions, clock, log } = raw;
  return {
    wifi: {
      isEnabled: async () => call(async () => wifi.isEnabled()),
      scan: async (scanSignal) => call(async () => wifi.scan(scanSignal)),
      currentNetwork: async () => call(async () => wifi.currentNetwork()),
      onNetworkChange: (cb) => {
        throwIfAborted(signal);
        return wifi.onNetworkChange((state) => {
          if (!signal.aborted) {
            cb(state);
          }
        });
      },
      join: async (target, joinSignal) =>
        call(async () => wifi.join(target, joinSignal)),
      bindToConnectedWifi: async () =>
        call(async () => wifi.bindToConnectedWifi()),
      release: async () => call(async () => wifi.release()),
      openWifiPanel: async () => call(async () => wifi.openWifiPanel()),
      openWifiSettings: async () => call(async () => wifi.openWifiSettings()),
    },
    speaker: {
      info: async (ip, requestSignal) =>
        call(async () => speaker.info(ip, requestSignal)),
      sendCredentials: async (ip, credentials, requestSignal) =>
        call(async () =>
          speaker.sendCredentials(ip, credentials, requestSignal),
        ),
      networkInfo: async (ip, requestSignal) =>
        call(async () => speaker.networkInfo(ip, requestSignal)),
      setupState: async (ip, requestSignal) =>
        call(async () => speaker.setupState(ip, requestSignal)),
      leaveSetup: async (ip, requestSignal) =>
        call(async () => speaker.leaveSetup(ip, requestSignal)),
      setName: async (ip, name, requestSignal) =>
        call(async () => speaker.setName(ip, name, requestSignal)),
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
    permissions: {
      location: async (request) =>
        call(async () => permissions.location(request)),
      locationServicesEnabled: async () =>
        call(async () => permissions.locationServicesEnabled()),
      openAppSettings: async () =>
        call(async () => permissions.openAppSettings()),
      openLocationSettings: async () =>
        call(async () => permissions.openLocationSettings()),
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
 * Runs speaker setup as a sequence of steps. React only renders `getView()`;
 * answers come back through `respond`. Speaker behaviour: docs/speaker-setup.md.
 */
export function createSetupSession(rawDeps: SetupDeps): SetupSession {
  const controller = new AbortController();
  const { signal } = controller;
  const deps = guardDeps(rawDeps, signal);
  const { clock, log } = deps;
  const listeners = new Set<() => void>();
  let view: SetupView = {
    kind: "working",
    step: "preflight",
    detail: { kind: "starting" },
    startedAt: clock.now(),
  };
  let accept: ((answer: PromptAnswer) => boolean) | undefined;
  let running: Promise<void> | undefined;
  let cancelling: Promise<void> | undefined;

  const ctx: Context = { homeSsid: null };
  let watch: LinkWatch | undefined;
  /** False only between a release and the next join. */
  let needsRelease = true;

  const publish = (nextView: SetupView) => {
    if (signal.aborted) {
      return;
    }
    view = nextView;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const listen: StepEnv["listen"] = (listenSignal, handler) => {
    if (listenSignal.aborted) {
      return;
    }
    const own = (answer: PromptAnswer) => handler(answer);
    accept = own;
    listenSignal.addEventListener("abort", () => {
      if (accept === own) {
        accept = undefined;
      }
    });
  };

  const waitFor = async <Answer>(
    waitSignal: AbortSignal,
    map: (answer: PromptAnswer) => Answer | undefined,
  ): Promise<Answer> =>
    new Promise<Answer>((resolve, reject) => {
      if (waitSignal.aborted) {
        reject(new AbortedError());
        return;
      }
      const waiting = childController(waitSignal);
      waiting.signal.addEventListener("abort", () => {
        reject(new AbortedError());
      });
      listen(waiting.signal, (answer) => {
        const value = map(answer);
        if (value === undefined) {
          return false;
        }
        resolve(value);
        waiting.dispose();
        return true;
      });
    });

  const env: StepEnv = {
    deps,
    working: (step, detail) => {
      const startedAt =
        view.kind === "working" && view.step === step
          ? view.startedAt
          : clock.now();
      publish({ kind: "working", step, detail, startedAt });
    },
    listen,
    ask: async (askSignal, prompt, map) => {
      throwIfAborted(askSignal);
      publish({ kind: "prompt", prompt });
      return waitFor(askSignal, map);
    },
  };

  const releaseLink = async () => {
    watch?.dispose();
    watch = undefined;
    needsRelease = false;
    await deps.wifi.release();
  };

  const runStep = async (entry: Entry): Promise<Outcome> => {
    switch (entry.step) {
      case "preflight": {
        const checked = await preflight(env, signal, entry);
        if (checked.isErr()) {
          return failed(checked.error);
        }
        ctx.homeSsid = checked.value.homeSsid;
        return next({ step: "findSpeaker" });
      }
      case "findSpeaker": {
        const found = await findSpeaker(env, signal);
        if (found.kind === "manual") {
          ctx.target = undefined;
          return next({ step: "join", mode: "manual" });
        }
        ctx.target = found.target;
        log.event("findSpeaker.found", { level: ctx.target.level });
        return next({ step: "join", mode: "auto" });
      }
      case "join": {
        const { target } = ctx;
        if (entry.mode === "auto" && !target) {
          return next({ step: "findSpeaker" });
        }
        watch?.dispose();
        watch = undefined;
        needsRelease = true;
        const joined = await join(
          env,
          signal,
          target && entry.mode === "auto"
            ? { mode: "auto", target }
            : { mode: "manual", target },
        );
        if (joined.isErr()) {
          return failed(joined.error);
        }
        ctx.identity = joined.value.identity;
        watch = new LinkWatch(joined.value.link, clock);
        return next({ step: "credentials" });
      }
      case "credentials": {
        if (!watch) {
          return next({ step: "join", mode: "auto" });
        }
        const options = {
          suggested: ctx.credentials?.ssid ?? ctx.homeSsid ?? undefined,
          reason: entry.reason,
        };
        const answered = await watch.guard(signal, async (promptSignal) =>
          Result.ok(await askCredentials(env, promptSignal, options)),
        );
        if (answered.isErr()) {
          return failed(answered.error);
        }
        ctx.credentials = answered.value;
        return next({ step: "deliver" });
      }
      case "deliver": {
        const { credentials } = ctx;
        if (!watch || !credentials) {
          return next({ step: "credentials" });
        }
        const delivered = await watch.guard(signal, async (deliverSignal) =>
          deliver(env, deliverSignal, credentials),
        );
        if (delivered.isErr()) {
          return failed(delivered.error);
        }
        if (delivered.value.kind === "rejected") {
          // Wrong password (or DHCP refused): ask again on the same link.
          return next({ step: "credentials", reason: "rejected" });
        }
        ctx.homeIp = delivered.value.homeIp;
        return next({ step: "leaveSetup" });
      }
      case "leaveSetup": {
        await leaveSetup(env, signal);
        await releaseLink();
        return next({ step: "rejoinHome" });
      }
      case "rejoinHome": {
        if (!ctx.credentials) {
          return next({ step: "credentials" });
        }
        const rejoined = await rejoinHome(
          env,
          signal,
          ctx.credentials.ssid,
          ctx.homeSsid,
        );
        return rejoined.isErr()
          ? failed(rejoined.error)
          : next({ step: "verify" });
      }
      case "verify": {
        if (!ctx.identity) {
          return next({ step: "findSpeaker" });
        }
        const verified = await verify(env, signal, {
          identity: ctx.identity,
          homeIp: ctx.homeIp,
          ip: entry.ip,
        });
        if (verified.isErr()) {
          return failed(verified.error);
        }
        return next({ step: "name", host: verified.value.host });
      }
      case "name": {
        if (!ctx.identity) {
          return next({ step: "findSpeaker" });
        }
        const named = await nameSpeaker(
          env,
          signal,
          entry.host,
          ctx.identity.name,
        );
        ctx.identity = { ...ctx.identity, name: named.name };
        return {
          kind: "done",
          speaker: ctx.identity,
          host: entry.host,
          renameFailed: named.renameFailed,
        };
      }
      default: {
        return unreachable(entry);
      }
    }
  };

  const retryEntry = (error: SetupError, failedEntry: Entry): Entry => {
    if (LinkLost.is(error)) {
      return { step: "join", mode: ctx.target ? "auto" : "manual" };
    }
    switch (failedEntry.step) {
      case "preflight": {
        return { step: "preflight", request: false, rationale: false };
      }
      case "verify": {
        return { step: "verify" };
      }
      default: {
        return failedEntry;
      }
    }
  };

  /** Performs `action`; returns the entry to re-enter, or nothing to stay on the failed view. */
  const applyAction = async (
    action: RecoveryAction,
    error: SetupError,
    failedEntry: Entry,
  ): Promise<Entry | undefined> => {
    const ignoreFailure = () => undefined;
    switch (action) {
      case "retry": {
        return retryEntry(error, failedEntry);
      }
      case "requestPermission": {
        return { step: "preflight", request: true, rationale: false };
      }
      case "openAppSettings": {
        await deps.permissions.openAppSettings().catch(ignoreFailure);
        return undefined;
      }
      case "openLocationSettings": {
        await deps.permissions.openLocationSettings().catch(ignoreFailure);
        return undefined;
      }
      case "openWifiPanel": {
        await deps.wifi.openWifiPanel().catch(ignoreFailure);
        return undefined;
      }
      case "openWifiSettings": {
        await deps.wifi.openWifiSettings().catch(ignoreFailure);
        return HomeWifiNotRestored.is(error)
          ? { step: "rejoinHome" }
          : { step: "join", mode: "manual" };
      }
      case "manualJoin": {
        return { step: "join", mode: "manual" };
      }
      case "editCredentials": {
        return { step: "credentials" };
      }
      case "continueAnyway": {
        return { step: "verify" };
      }
      case "enterIp": {
        // Needs an address: answered with `{ kind: "enterIp", ip }`.
        return undefined;
      }
      case "startOver": {
        ctx.target = undefined;
        ctx.identity = undefined;
        ctx.credentials = undefined;
        ctx.homeIp = undefined;
        watch?.dispose();
        watch = undefined;
        return failedEntry.step === "preflight"
          ? { step: "preflight", request: true, rationale: false }
          : { step: "findSpeaker" };
      }
      default: {
        return unreachable(action);
      }
    }
  };

  /** Shows the failed view until an action re-enters a step. */
  const recover = async (
    error: SetupError,
    failedEntry: Entry,
  ): Promise<Entry> => {
    const actions = recoveryActions(error);
    log.event("step.failed", { step: failedEntry.step, error: error.name });
    publish({ kind: "failed", error, actions });
    for (;;) {
      const answer = await waitFor(signal, (reply) => {
        if (reply.kind === "action" && actions.includes(reply.action)) {
          return reply;
        }
        if (
          reply.kind === "enterIp" &&
          actions.includes("enterIp") &&
          reply.ip.trim() !== ""
        ) {
          return reply;
        }
        return undefined;
      });
      if (answer.kind === "enterIp") {
        return { step: "verify", ip: answer.ip.trim() };
      }
      log.event("action", { action: answer.action });
      const entry = await applyAction(answer.action, error, failedEntry);
      if (entry) {
        return entry;
      }
    }
  };

  const run = async () => {
    let entry: Entry = { step: "preflight", request: true, rationale: true };
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
          outcome = failed(
            new UnexpectedError({
              step: entry.step,
              message: errorMessage(error),
            }),
          );
        }
        if (outcome.kind === "done") {
          log.event("done", { deviceID: outcome.speaker.deviceID });
          publish({
            kind: "done",
            speaker: outcome.speaker,
            host: outcome.host,
            ...(outcome.renameFailed ? { renameFailed: true } : {}),
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
      watch?.dispose();
      watch = undefined;
      if (needsRelease) {
        needsRelease = false;
        await rawDeps.wifi.release().catch(() => undefined);
      }
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
    respond: (answer) => {
      if (!signal.aborted) {
        accept?.(answer);
      }
    },
    cancel: async () => {
      cancelling ??= (async () => {
        if (!signal.aborted) {
          log.event("cancel", { view: view.kind });
          controller.abort();
        }
        await running;
      })();
      return cancelling;
    },
  };
}
