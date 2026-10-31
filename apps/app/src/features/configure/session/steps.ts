import { Result } from "better-result";

import {
  raceCancel,
  retryWithin,
  sleep,
  type Task,
  withTimeout,
} from "../../onboarding/session/async";
import { sameDevice } from "../../onboarding/session/steps/env";
import { isSafeServerUrl } from "../../server/server-url";
import { isSafeAccountId, isSameOrigin } from "../../speakers/lib/account-id";
import {
  differingUrls,
  isRefusal,
  pairCommand,
  parseConfiguration,
  READ_CONFIGURATION,
  REBOOT,
  serverUrlsFor,
  type ServerUrls,
  writeUrlCommands,
} from "./console";
import {
  CommandFailed,
  ConsoleUnavailable,
  DidNotRestart,
  InvalidServer,
  NotApplied,
  NotBack,
  NotPaired,
  RestartFailed,
  ServerNotContacted,
  ServerUnreachable,
  SettingsNotSaved,
  SpeakerOffline,
  UnexpectedError,
} from "./errors";
import {
  type ConfigureDeps,
  type ConsoleConnection,
  type LastContact,
  PortFailure,
  type SpeakerInfo,
} from "./ports";
import type { ConfigureTarget, StepId, WorkingDetail } from "./types";

/** Per-request timeout for the speaker's HTTP API. */
export const REQUEST_TIMEOUT_MS = 3000;
/** How long the speaker gets to answer before setup starts. */
export const INFO_BUDGET_MS = 9000;
export const INFO_INTERVAL_MS = 3000;
/** Console connection attempts; each one times out on its own (bose-api-speaker-client). */
export const CONSOLE_OPEN_ATTEMPTS = 3;
export const CONSOLE_RETRY_MS = 2000;
/** How long the speaker gets to fetch its sources before it restarts. */
export const SOURCES_REFRESH_MS = 5000;
/** How long `sys reboot` may take to answer; the speaker often hangs up instead. */
export const REBOOT_REPLY_MS = 3000;
/** How long the server gets to report the speaker's last request before the restart. */
export const BASELINE_BUDGET_MS = 10_000;
/**
 * Untested on hardware: a SoundTouch is off the network for tens of seconds
 * while it restarts; the speaker counts as down after two missed polls in a
 * row, so a single lost request isn't mistaken for the restart.
 */
export const SHUTDOWN_BUDGET_MS = 45_000;
export const SHUTDOWN_POLL_MS = 2000;
export const SHUTDOWN_MISSES = 2;
/** Untested on hardware; the previous flow waited up to 132 s. */
export const RETURN_BUDGET_MS = 180_000;
export const RETURN_POLL_MS = 3000;
/** The speaker calls the server (`power_on`) while it starts. */
export const CONTACT_BUDGET_MS = 90_000;
export const CONTACT_POLL_MS = 3000;

/** Survives recovery actions. */
export interface RunContext {
  readonly target: ConfigureTarget;
  /** The speaker's address; updated when it comes back from the restart. */
  host: string;
  origin?: string;
  urls?: ServerUrls;
  accountId?: string;
  /** Whether this run pairs the speaker (it had no account). */
  pairing: boolean;
  console?: ConsoleConnection;
  /** The speaker's last request to the server before the restart. */
  baseline?: LastContact;
}

export interface StepEnv {
  /** Ports; every call rejects with `AbortedError` once the session is cancelled. */
  readonly deps: ConfigureDeps;
  working: (step: StepId, detail: WorkingDetail) => void;
}

type StepResult<Failure> = Promise<Result<void, Failure>>;

const ok = (): Result<void, never> => Result.ok(undefined);

/** One speaker request bounded by `REQUEST_TIMEOUT_MS`. */
async function request<Value>(
  deps: ConfigureDeps,
  signal: AbortSignal,
  call: Task<Result<Value, PortFailure>>,
): Promise<Result<Value, PortFailure>> {
  return withTimeout(
    deps.clock,
    REQUEST_TIMEOUT_MS,
    signal,
    call,
    () =>
      new PortFailure({ message: `No answer within ${REQUEST_TIMEOUT_MS} ms` }),
  );
}

async function speakerInfo(
  deps: ConfigureDeps,
  signal: AbortSignal,
  host: string,
  budgetMs: number,
): Promise<Result<SpeakerInfo, PortFailure>> {
  return retryWithin(
    deps.clock,
    signal,
    { budgetMs, intervalMs: INFO_INTERVAL_MS },
    async (attempt) =>
      request(deps, attempt, async (call) => deps.speaker.info(host, call)),
    (last) =>
      last ?? new PortFailure({ message: `No answer within ${budgetMs} ms` }),
  );
}

/** Opens the console, retrying a few times: the speaker is sometimes slow to accept. */
async function openConsole(
  deps: ConfigureDeps,
  signal: AbortSignal,
  host: string,
): Promise<Result<ConsoleConnection, PortFailure>> {
  for (let attempt = 1; ; attempt++) {
    const opened = await deps.console.open(host);
    if (opened.isOk() || attempt === CONSOLE_OPEN_ATTEMPTS) {
      return opened;
    }
    deps.log.event("console.retry", { attempt });
    await sleep(deps.clock, CONSOLE_RETRY_MS, signal);
  }
}

export function closeConsole(ctx: RunContext): void {
  ctx.console?.close();
  ctx.console = undefined;
}

/**
 * Runs `command` on the console. `label` replaces it in errors and logs when
 * it contains a secret.
 */
async function runCommand(
  deps: ConfigureDeps,
  connection: ConsoleConnection,
  command: string,
  label = command,
): Promise<Result<string, CommandFailed>> {
  const reply = await connection.run(command);
  if (reply.isErr()) {
    deps.log.event("console.failed", {
      command: label,
      reason: reply.error.reason,
    });
    return Result.err(
      new CommandFailed({
        command: label,
        message: reply.error.message,
        ...(reply.error.reply === undefined
          ? {}
          : { reply: reply.error.reply }),
      }),
    );
  }
  if (isRefusal(reply.value)) {
    deps.log.event("console.refused", { command: label, reply: reply.value });
    return Result.err(
      new CommandFailed({
        command: label,
        message: "The speaker refused the command",
        reply: reply.value,
      }),
    );
  }
  deps.log.event("console.ok", { command: label });
  return Result.ok(reply.value);
}

/**
 * Checks the speaker and the server, picks the account and stores the
 * speaker's presets on the server: the speaker replaces its presets with the
 * stored ones when it starts paired, so they must be there first.
 */
export async function prepare(
  env: StepEnv,
  signal: AbortSignal,
  ctx: RunContext,
): StepResult<
  SpeakerOffline | InvalidServer | ServerUnreachable | UnexpectedError
> {
  const { deps } = env;
  env.working("prepare", { kind: "checkingSpeaker" });
  const origin = deps.server.origin();
  if (!isSafeServerUrl(origin)) {
    return Result.err(new InvalidServer({ origin }));
  }
  ctx.origin = origin;
  ctx.urls = serverUrlsFor(origin);

  const info = await speakerInfo(deps, signal, ctx.host, INFO_BUDGET_MS);
  if (info.isErr()) {
    return Result.err(
      new SpeakerOffline({ host: ctx.host, message: info.error.message }),
    );
  }
  if (!sameDevice(info.value.deviceID, ctx.target.deviceID)) {
    return Result.err(
      new SpeakerOffline({
        host: ctx.host,
        message: `Another device (${info.value.deviceID}) answers at ${ctx.host}`,
      }),
    );
  }

  const account = await deps.server.householdAccount(
    {
      margeAccountUUID: info.value.margeAccountUUID,
      margeURL: info.value.margeURL,
    },
    ctx.target.otherSpeakers,
  );
  if (account.isErr()) {
    return Result.err(
      new ServerUnreachable({
        need: "account",
        message: account.error.message,
      }),
    );
  }
  ctx.accountId = account.value;
  ctx.pairing = info.value.margeAccountUUID === "";
  if (ctx.pairing && !isSafeAccountId(ctx.accountId)) {
    return Result.err(
      new UnexpectedError({
        step: "prepare",
        message:
          "The server returned an account id that can't be sent to a speaker",
      }),
    );
  }

  env.working("prepare", { kind: "savingPresets" });
  const presets = await request(deps, signal, async (call) =>
    deps.speaker.presets(ctx.host, call),
  );
  if (presets.isErr()) {
    return Result.err(
      new SpeakerOffline({ host: ctx.host, message: presets.error.message }),
    );
  }
  const saved = await deps.server.savePresets(
    ctx.accountId,
    ctx.target.deviceID,
    presets.value,
    signal,
  );
  if (saved.isErr()) {
    return Result.err(
      new ServerUnreachable({ need: "presets", message: saved.error.message }),
    );
  }
  deps.log.event("prepare.done", {
    presets: presets.value.length,
    pairing: ctx.pairing,
  });
  return ok();
}

/**
 * Writes the server addresses, reads them back, pairs the speaker if it has
 * no account and has it refresh its sources. Leaves the console open for the
 * restart.
 */
export async function connect(
  env: StepEnv,
  signal: AbortSignal,
  ctx: RunContext,
): StepResult<
  ConsoleUnavailable | CommandFailed | SettingsNotSaved | UnexpectedError
> {
  const { deps } = env;
  const { urls, accountId } = ctx;
  if (!urls || accountId === undefined) {
    return Result.err(
      new UnexpectedError({
        step: "connect",
        message: "Setup wasn't prepared",
      }),
    );
  }
  env.working("connect", { kind: "writingSettings" });
  closeConsole(ctx);
  const opened = await openConsole(deps, signal, ctx.host);
  if (opened.isErr()) {
    return Result.err(
      new ConsoleUnavailable({ message: opened.error.message }),
    );
  }
  const connection = opened.value;
  ctx.console = connection;

  for (const command of writeUrlCommands(urls)) {
    const written = await runCommand(deps, connection, command);
    if (written.isErr()) {
      return Result.err(written.error);
    }
  }

  const readBack = await connection.run(READ_CONFIGURATION);
  if (readBack.isOk()) {
    const differing = differingUrls(parseConfiguration(readBack.value), urls);
    if (differing === undefined) {
      deps.log.event("connect.readBack", { readable: false });
    } else if (differing.length > 0) {
      return Result.err(new SettingsNotSaved({ fields: differing }));
    }
  } else {
    deps.log.event("connect.readBack", { failed: readBack.error.reason });
  }

  if (ctx.pairing) {
    env.working("connect", { kind: "pairing" });
    const paired = await runCommand(
      deps,
      connection,
      pairCommand(accountId),
      "envswitch accountid set …",
    );
    if (paired.isErr()) {
      return Result.err(paired.error);
    }
    // The console pairing takes effect at the restart; this one at once,
    // where the firmware has it. The restart check tells whether either did.
    const httpPaired = await request(deps, signal, async (call) =>
      deps.speaker.setMargeAccount(ctx.host, accountId, call),
    );
    if (httpPaired.isErr()) {
      deps.log.event("connect.setMargeAccount", {
        failed: httpPaired.error.message,
      });
    }
  }

  // The speaker only activates source types it had saved when it starts:
  // have it fetch and save the server's sources now, or a source it learns
  // at the coming start would only play after another restart.
  env.working("connect", { kind: "refreshingSources" });
  const refreshed = await request(deps, signal, async (call) =>
    deps.speaker.sourcesUpdated(ctx.host, ctx.target.deviceID, call),
  );
  if (refreshed.isOk()) {
    await sleep(deps.clock, SOURCES_REFRESH_MS, signal);
  } else {
    deps.log.event("connect.sourcesUpdated", {
      failed: refreshed.error.message,
    });
  }
  return ok();
}

/** Notes the speaker's last request to the server, then restarts the speaker. */
export async function restart(
  env: StepEnv,
  signal: AbortSignal,
  ctx: RunContext,
): StepResult<ServerUnreachable | RestartFailed> {
  const { deps } = env;
  env.working("restart", { kind: "restarting" });
  const baseline = await retryWithin(
    deps.clock,
    signal,
    { budgetMs: BASELINE_BUDGET_MS, intervalMs: CONTACT_POLL_MS },
    async (attempt) =>
      request(deps, attempt, async (call) =>
        deps.server.lastContact(ctx.target.deviceID, call),
      ),
    (last) => last ?? new PortFailure({ message: "No answer" }),
  );
  if (baseline.isErr()) {
    return Result.err(
      new ServerUnreachable({
        need: "contact",
        message: baseline.error.message,
      }),
    );
  }
  ctx.baseline = baseline.value;

  let connection = ctx.console;
  if (!connection) {
    const reopened = await openConsole(deps, signal, ctx.host);
    if (reopened.isErr()) {
      return Result.err(new RestartFailed({ message: reopened.error.message }));
    }
    connection = reopened.value;
    ctx.console = connection;
  }
  let sent = await connection.run(REBOOT, { timeoutMs: REBOOT_REPLY_MS });
  if (sent.isErr() && sent.error.reason === "notConnected") {
    // The speaker closed the idle connection: reconnect once.
    closeConsole(ctx);
    const reopened = await openConsole(deps, signal, ctx.host);
    if (reopened.isErr()) {
      return Result.err(new RestartFailed({ message: reopened.error.message }));
    }
    ctx.console = reopened.value;
    sent = await reopened.value.run(REBOOT, { timeoutMs: REBOOT_REPLY_MS });
  }
  closeConsole(ctx);
  // A restarting speaker hangs up or stays silent; both mean it got the command.
  if (
    sent.isErr() &&
    (sent.error.reason === "notConnected" || sent.error.reason === "busy")
  ) {
    return Result.err(new RestartFailed({ message: sent.error.message }));
  }
  deps.log.event("restart.sent", {
    reply: sent.isOk() ? "reply" : sent.error.reason,
  });
  return ok();
}

/** Waits for the speaker to go down (unless it already did), then to answer again. */
export async function awaitRestart(
  env: StepEnv,
  signal: AbortSignal,
  ctx: RunContext,
  options: { skipShutdown: boolean },
): StepResult<DidNotRestart | NotBack> {
  const { deps } = env;
  const { clock, log } = deps;
  if (!options.skipShutdown) {
    env.working("restart", { kind: "waitingForShutdown" });
    const down = await withTimeout(
      clock,
      SHUTDOWN_BUDGET_MS,
      signal,
      async (pollSignal) => {
        let misses = 0;
        for (;;) {
          const info = await request(deps, pollSignal, async (call) =>
            deps.speaker.info(ctx.host, call),
          );
          misses = info.isErr() ? misses + 1 : 0;
          if (misses >= SHUTDOWN_MISSES) {
            return ok();
          }
          await sleep(clock, SHUTDOWN_POLL_MS, pollSignal);
        }
      },
      () => new DidNotRestart(),
    );
    if (down.isErr()) {
      return down;
    }
    log.event("restart.down");
  }

  env.working("restart", { kind: "waitingForSpeaker" });
  const { deviceID } = ctx.target;
  const answersAt = async (host: string, probeSignal: AbortSignal) => {
    const info = await request(deps, probeSignal, async (call) =>
      deps.speaker.info(host, call),
    );
    return info.isOk() && sameDevice(info.value.deviceID, deviceID);
  };
  const previousHost = ctx.host;
  const found = await withTimeout(
    clock,
    RETURN_BUDGET_MS,
    signal,
    async (raceSignal) =>
      raceCancel<string, NotBack>(raceSignal, [
        async (pollSignal) => {
          for (;;) {
            if (await answersAt(previousHost, pollSignal)) {
              return Result.ok(previousHost);
            }
            await sleep(clock, RETURN_POLL_MS, pollSignal);
          }
        },
        // The speaker may come back on another address.
        async (browseSignal) => {
          for await (const service of deps.discovery.browse(browseSignal)) {
            if (
              service.mac !== null &&
              sameDevice(service.mac, deviceID) &&
              (await answersAt(service.host, browseSignal))
            ) {
              return Result.ok(service.host);
            }
          }
          return Result.err(new NotBack({ deviceID }));
        },
      ]),
    () => new NotBack({ deviceID }),
  );
  if (found.isErr()) {
    return Result.err(found.error);
  }
  ctx.host = found.value;
  log.event("restart.back", { sameHost: found.value === previousHost });
  return ok();
}

/**
 * Checks what the speaker uses after the restart: our server, the household
 * account, the four addresses (as saved, now that it has restarted) and
 * finally that it made a request to our server.
 */
export async function verify(
  env: StepEnv,
  signal: AbortSignal,
  ctx: RunContext,
): Promise<
  Result<
    { serverConfirmed: boolean },
    NotBack | NotApplied | NotPaired | ServerNotContacted | UnexpectedError
  >
> {
  const { deps } = env;
  const { clock, log } = deps;
  const { origin, urls, accountId } = ctx;
  if (origin === undefined || !urls || accountId === undefined) {
    return Result.err(
      new UnexpectedError({ step: "verify", message: "Setup wasn't prepared" }),
    );
  }
  env.working("verify", { kind: "checkingSettings" });
  const info = await speakerInfo(deps, signal, ctx.host, INFO_BUDGET_MS);
  if (info.isErr()) {
    return Result.err(new NotBack({ deviceID: ctx.target.deviceID }));
  }
  if (!isSameOrigin(info.value.margeURL, origin)) {
    return Result.err(new NotApplied({ what: "server" }));
  }
  const paired = ctx.pairing
    ? info.value.margeAccountUUID === accountId
    : info.value.margeAccountUUID !== "";
  if (!paired) {
    return Result.err(new NotPaired());
  }

  const opened = await openConsole(deps, signal, ctx.host);
  if (opened.isOk()) {
    ctx.console = opened.value;
    const readBack = await opened.value.run(READ_CONFIGURATION);
    closeConsole(ctx);
    const differing = readBack.isOk()
      ? differingUrls(parseConfiguration(readBack.value), urls)
      : undefined;
    if (differing !== undefined && differing.length > 0) {
      return Result.err(new NotApplied({ what: differing }));
    }
    log.event("verify.readBack", { checked: differing !== undefined });
  } else {
    log.event("verify.readBack", { console: false });
  }

  const baseline = ctx.baseline;
  if (!baseline?.supported) {
    log.event("verify.contact", { supported: false });
    return Result.ok({ serverConfirmed: false });
  }
  env.working("verify", { kind: "waitingForServer" });
  const contacted = await retryWithin(
    clock,
    signal,
    { budgetMs: CONTACT_BUDGET_MS, intervalMs: CONTACT_POLL_MS },
    async (attempt): Promise<Result<void, ServerNotContacted>> => {
      const contact = await request(deps, attempt, async (call) =>
        deps.server.lastContact(ctx.target.deviceID, call),
      );
      const at =
        contact.isOk() && contact.value.supported ? contact.value.at : null;
      return at !== null && (baseline.at === null || at > baseline.at)
        ? ok()
        : Result.err(new ServerNotContacted());
    },
    () => new ServerNotContacted(),
  );
  if (contacted.isErr()) {
    return Result.err(contacted.error);
  }
  log.event("verify.contact", { supported: true });
  return Result.ok({ serverConfirmed: true });
}
