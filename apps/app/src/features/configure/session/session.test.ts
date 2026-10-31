import { describe, expect, it } from "vite-plus/test";

import { ManualClock } from "../../onboarding/session/testing/fakes";
import { serverUrlsFor } from "./console";
import { createConfigureSession } from "./session";
import { RETURN_BUDGET_MS } from "./steps";
import { BOSE_URLS, type FakeConfigureWorld } from "./testing/fakes";
import {
  createScenario,
  HOUSEHOLD_ACCOUNT,
  MINTED_ACCOUNT,
  NEW_HOST,
  PRESETS,
  type ScenarioName,
  SERVER_ORIGIN,
  TARGET_ID,
  targetOf,
} from "./testing/scenarios";
import type { ConfigureSession, ConfigureView, RecoveryAction } from "./types";

type FailedView = Extract<ConfigureView, { kind: "failed" }>;
type DoneView = Extract<ConfigureView, { kind: "done" }>;

interface Harness {
  clock: ManualClock;
  world: FakeConfigureWorld;
  session: ConfigureSession;
  untilFailed: (tag: string) => Promise<FailedView>;
  untilDone: () => Promise<DoneView>;
  untilWorking: (detail: string) => Promise<void>;
  act: (action: RecoveryAction) => Promise<void>;
}

function start(name: ScenarioName): Harness {
  const clock = new ManualClock();
  const world = createScenario(name, clock);
  const session = createConfigureSession(world.deps(), targetOf(world));
  const views: ConfigureView[] = [];
  session.subscribe(() => {
    views.push(session.getView());
  });
  let cursor = 0;
  const until = async (predicate: (view: ConfigureView) => boolean) => {
    let found: ConfigureView | undefined;
    await clock.runUntil(() => {
      const index = views.findIndex(
        (view, position) => position >= cursor && predicate(view),
      );
      if (index === -1) {
        return false;
      }
      found = views[index];
      cursor = index + 1;
      return true;
    });
    return found!;
  };
  session.start();
  return {
    clock,
    world,
    session,
    untilFailed: async (tag) =>
      (await until(
        (view) => view.kind === "failed" && view.error.name === tag,
      )) as FailedView,
    untilDone: async () =>
      (await until((view) => view.kind === "done")) as DoneView,
    untilWorking: async (detail) => {
      await until(
        (view) => view.kind === "working" && view.detail.kind === detail,
      );
    },
    act: async (action) => {
      session.act(action);
      await clock.advance(0);
    },
  };
}

const ourUrls = serverUrlsFor(SERVER_ORIGIN);

describe("configure session", () => {
  it("points an unpaired speaker at the server, pairs it and confirms it called the server", async () => {
    const { world, untilDone } = start("happyPath");

    const done = await untilDone();

    expect(done).toEqual({
      kind: "done",
      host: world.config.speaker.host,
      serverConfirmed: true,
    });
    expect(world.saved).toEqual(ourUrls);
    expect(world.running).toEqual(ourUrls);
    expect(world.margeAccountUUID).toBe(MINTED_ACCOUNT);
    expect(world.restarts).toBe(1);
    expect(world.openConsoles).toBe(0);
  });

  it("stores the presets under the paired account before anything changes on the speaker", async () => {
    const { world, untilDone } = start("happyPath");

    await untilDone();

    expect(world.storedPresets.get(`${MINTED_ACCOUNT}/${TARGET_ID}`)).toEqual(
      PRESETS,
    );
    const saved = world.firstEvent("presetsSaved")?.at ?? Infinity;
    const firstCommand = world.firstEvent("command")?.at ?? -Infinity;
    expect(saved).toBeLessThan(firstCommand);
  });

  it("stops before touching the speaker when the server refuses the presets", async () => {
    const { world, untilFailed } = start("presetsRejected");

    const failed = await untilFailed("ServerUnreachable");

    expect(failed.step).toBe("prepare");
    expect(failed.actions).toEqual(["retry"]);
    expect(world.firstEvent("command")).toBeUndefined();
    expect(world.saved).toEqual(BOSE_URLS);
  });

  it("keeps a paired speaker's account and only finishes once it has really restarted", async () => {
    const { world, untilDone } = start("reconfigure");

    const done = await untilDone();

    expect(done.serverConfirmed).toBe(true);
    expect(world.margeAccountUUID).toBe(HOUSEHOLD_ACCOUNT);
    expect(world.firstEvent("accountMinted")).toBeUndefined();
    // Still answering for 8 s after the command, and already on our server:
    // only the request it made while starting again ends the wait.
    const up = world.firstEvent("up")?.at ?? Infinity;
    expect(world.clock.now()).toBeGreaterThanOrEqual(up);
  });

  it("finds the speaker when it comes back on another address", async () => {
    const { untilDone } = start("newAddress");

    const done = await untilDone();

    expect(done.host).toBe(NEW_HOST);
  });

  it("pairs through the console when the speaker has no HTTP pairing", async () => {
    const { world, untilDone } = start("noHttpPairing");

    await untilDone();

    expect(world.margeAccountUUID).toBe(MINTED_ACCOUNT);
  });

  it("does not restart the speaker when it refuses a command", async () => {
    const { world, untilFailed } = start("refusesEnvswitch");

    const failed = await untilFailed("CommandFailed");

    expect(failed.step).toBe("connect");
    expect(world.restarts).toBe(0);
    expect(world.openConsoles).toBe(0);
  });

  it("does not restart the speaker when the addresses don't read back", async () => {
    const { world, untilFailed } = start("ignoresSettings");

    const failed = await untilFailed("SettingsNotSaved");

    expect(failed.error).toMatchObject({
      fields: ["bmxRegistryUrl", "statsServerUrl"],
    });
    expect(world.restarts).toBe(0);
  });

  it("reports a speaker that restarts with its old addresses", async () => {
    const { untilFailed } = start("forgetsAtRestart");

    const failed = await untilFailed("NotApplied");

    expect(failed.step).toBe("verify");
    expect(failed.error).toMatchObject({ what: "server" });
  });

  it("explains that port 17000 is closed without changing anything", async () => {
    const { world, untilFailed } = start("consoleClosed");

    const failed = await untilFailed("ConsoleUnavailable");

    expect(failed.step).toBe("connect");
    expect(world.saved).toEqual(BOSE_URLS);
  });

  it("checks again for a slow speaker without restarting it a second time", async () => {
    const { world, clock, untilFailed, untilDone, act } = start("slowRestart");

    const failed = await untilFailed("NotBack");
    expect(failed.actions).toEqual(["checkAgain", "retry"]);
    expect(clock.now() - (world.firstEvent("down")?.at ?? 0)).toBeGreaterThan(
      RETURN_BUDGET_MS - 1,
    );

    await act("checkAgain");
    await untilDone();

    expect(world.restarts).toBe(1);
  });

  it("finishes without the server's confirmation when the server can't report requests", async () => {
    const { untilDone } = start("oldServer");

    const done = await untilDone();

    expect(done.serverConfirmed).toBe(false);
  });

  it("reports a speaker that never reaches the server, and confirms once it does", async () => {
    const { world, untilFailed, untilDone, act } = start("speakerOffline");

    const failed = await untilFailed("ServerNotContacted");
    expect(failed.step).toBe("verify");

    world.contactServer();
    await act("checkAgain");
    const done = await untilDone();

    expect(done.serverConfirmed).toBe(true);
    expect(world.restarts).toBe(1);
  });

  it("runs the whole setup again on retry", async () => {
    const { world, untilFailed, untilDone, act } = start("speakerOffline");

    await untilFailed("ServerNotContacted");
    world.config.speaker.contactsServer = true;
    await act("retry");
    await untilDone();

    expect(world.restarts).toBe(2);
  });

  it("stops talking to the speaker once cancelled", async () => {
    const { world, clock, session, untilWorking } = start("happyPath");

    await untilWorking("waitingForShutdown");
    await session.cancel();
    const eventsAtCancel = world.log.events.length;
    await clock.advance(10 * 60_000);

    expect(world.log.events.length).toBe(eventsAtCancel);
    expect(world.openConsoles).toBe(0);
  });
});
