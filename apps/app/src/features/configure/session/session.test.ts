import { describe, expect, it } from "vite-plus/test";

import { ManualClock } from "../../onboarding/session/testing/fakes";
import { serverUrlsFor } from "./console";
import { describeError } from "./errors";
import { createConfigureSession } from "./session";
import { RETURN_BUDGET_MS, SAVE_PRESETS_TIMEOUT_MS } from "./steps";
import { BOSE_URLS, type FakeConfigureWorld } from "./testing/fakes";
import {
  createScenario,
  HOUSEHOLD_ACCOUNT,
  NEW_ACCOUNT,
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
    expect(world.margeAccountUUID).toBe(NEW_ACCOUNT);
    expect(world.restarts).toBe(1);
    expect(world.openConsoles).toBe(0);
  });

  it("stores the presets under the paired account before anything changes on the speaker", async () => {
    const { world, untilDone } = start("happyPath");

    await untilDone();

    expect(world.storedPresets.get(`${NEW_ACCOUNT}/${TARGET_ID}`)).toEqual(
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

  it("gives up on a server that never answers the presets, before touching the speaker", async () => {
    const { world, clock, untilFailed } = start("presetsHang");
    const startedAt = clock.now();

    const failed = await untilFailed("ServerUnreachable");

    expect(failed.step).toBe("prepare");
    expect(world.firstEvent("command")).toBeUndefined();
    expect(clock.now() - startedAt).toBeLessThan(
      SAVE_PRESETS_TIMEOUT_MS + 30_000,
    );
  });

  it("keeps checking the server it set the speaker up for when the user picks another one", async () => {
    const { world, untilWorking, untilDone } = start("happyPath");

    await untilWorking("waitingForShutdown");
    world.appServer = "https://other.example";
    const done = await untilDone();

    expect(done.serverConfirmed).toBe(true);
  });

  it("stores the presets and notes the last contact on the server it started with when the user picks another one", async () => {
    const { world, untilWorking, untilDone } = start("happyPath");

    await untilWorking("savingPresets");
    world.appServer = "https://other.example";
    const done = await untilDone();

    expect(done.serverConfirmed).toBe(true);
    expect(world.storedPresets.get(`${NEW_ACCOUNT}/${TARGET_ID}`)).toEqual(
      PRESETS,
    );
  });

  it("stops before touching the speaker or the account when the server is older than the app supports", async () => {
    const { world, untilFailed } = start("serverTooOld");

    const failed = await untilFailed("UnsupportedServer");

    expect(failed.step).toBe("prepare");
    expect(failed.actions).toEqual(["retry"]);
    expect(world.firstEvent("accountCreated")).toBeUndefined();
    expect(world.firstEvent("presetsSaved")).toBeUndefined();
    expect(world.firstEvent("command")).toBeUndefined();
    expect(world.saved).toEqual(BOSE_URLS);
  });

  it("keeps a paired speaker's account and only finishes once it has really restarted", async () => {
    const { world, untilDone } = start("reconfigure");

    const done = await untilDone();

    expect(done.serverConfirmed).toBe(true);
    expect(world.margeAccountUUID).toBe(HOUSEHOLD_ACCOUNT);
    expect(world.firstEvent("accountCreated")).toBeUndefined();
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

    expect(world.margeAccountUUID).toBe(NEW_ACCOUNT);
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

describe("configure session with a stereo pair", () => {
  it("asks before moving a paired speaker to another server, with nothing written yet", async () => {
    const { world, untilFailed } = start("stereoPairMoving");

    const failed = await untilFailed("PairWouldBreak");

    expect(failed.step).toBe("prepare");
    expect(failed.actions).toEqual(["unpair"]);
    expect(describeError(failed.error, "Kitchen", "api.revivest.app")).toEqual({
      title: "Kitchen is in a stereo pair",
      message:
        "Kitchen is the left speaker of Kitchen + Living room. Setting it up for api.revivest.app breaks the pair: Living room would keep waiting for it and refuse to play. Nothing was changed on the speaker.",
    });
    expect(world.firstEvent("presetsSaved")).toBeUndefined();
    expect(world.firstEvent("command")).toBeUndefined();
    expect(world.firstEvent("groupRemoved")).toBeUndefined();
    expect(world.group).not.toBeNull();
  });

  it("unpairs the speaker, then sets it up, when the user chooses to", async () => {
    const { world, untilFailed, untilDone, act } = start("stereoPairMoving");
    await untilFailed("PairWouldBreak");

    await act("unpair");
    const done = await untilDone();

    expect(done.unpairedFrom).toBe("Living room");
    expect(world.group).toBeNull();
    const removed = world.firstEvent("groupRemoved")?.at ?? Infinity;
    const firstCommand = world.firstEvent("command")?.at ?? -Infinity;
    expect(removed).toBeLessThan(firstCommand);
    expect(world.running).toEqual(ourUrls);
  });

  it("writes nothing when the user cancels instead", async () => {
    const { world, session, untilFailed } = start("stereoPairMoving");
    await untilFailed("PairWouldBreak");

    await session.cancel();

    expect(world.events.map((event) => event.kind)).toEqual(["groupRead"]);
    expect(world.group).not.toBeNull();
    expect(world.running).toEqual(BOSE_URLS);
  });

  it("keeps the pair when the speaker is set up again for its server and account", async () => {
    const { world, untilDone } = start("stereoPairAgain");

    const done = await untilDone();

    expect(done.unpairedFrom).toBeUndefined();
    expect(world.firstEvent("groupRead")).toBeDefined();
    expect(world.firstEvent("groupRemoved")).toBeUndefined();
    expect(world.group).not.toBeNull();
  });

  it("never asks a speaker other than a SoundTouch 10 for its pair", async () => {
    const { world, untilDone } = start("happyPath");

    await untilDone();

    expect(world.firstEvent("groupRead")).toBeUndefined();
  });

  it("goes on with setup when the speaker doesn't say whether it's paired", async () => {
    const { world, untilDone } = start("groupReadHangs");

    const done = await untilDone();

    expect(done.unpairedFrom).toBeUndefined();
    expect(world.firstEvent("groupRemoved")).toBeUndefined();
    expect(world.running).toEqual(ourUrls);
  });
});
