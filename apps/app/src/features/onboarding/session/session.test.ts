import { describe, expect, it } from "vite-plus/test";

import { NotVerified, SpeakerUnreachable } from "./errors";
import { createSetupSession } from "./session";
import { DELIVER_TIMEOUT_MS } from "./steps/deliver";
import { PROBE_TIMEOUT_MS } from "./steps/env";
import { SCAN_INTERVAL_MS } from "./steps/findSpeaker";
import { JOIN_PROBE_BUDGET_MS } from "./steps/join";
import { REJOIN_HOME_TIMEOUT_MS } from "./steps/rejoinHome";
import { VERIFY_TIMEOUT_MS } from "./steps/verify";
import {
  type FakeWorldConfig,
  FakeWorld,
  flushPromises,
  ManualClock,
} from "./testing/fakes";
import {
  createScenario,
  HOME_PASSWORD,
  HOME_SSID,
  OFFICE_PASSWORD,
  OFFICE_SSID,
  OPEN_SSID,
  OTHER_ID,
  type ScenarioName,
  SECOND_ID,
  scenarios,
  TARGET_HOME_IP,
  TARGET_ID,
  targetSpeaker,
} from "./testing/scenarios";
import type {
  Prompt,
  PromptAnswer,
  RecoveryAction,
  SetupSession,
  SetupView,
  StepId,
} from "./types";

// ---------------------------------------------------------------------------
// Harness

type FailedView = Extract<SetupView, { kind: "failed" }>;
type DoneView = Extract<SetupView, { kind: "done" }>;

interface Harness {
  clock: ManualClock;
  world: FakeWorld;
  session: SetupSession;
  /** Every published view, in order. */
  views: SetupView[];
  view: () => SetupView;
  until: (predicate: (view: SetupView) => boolean) => Promise<SetupView>;
  untilPrompt: <Kind extends Prompt["kind"]>(
    kind: Kind,
  ) => Promise<Extract<Prompt, { kind: Kind }>>;
  untilFailed: (tag: string) => Promise<FailedView>;
  untilWorking: (step: StepId, detail?: string) => Promise<SetupView>;
  untilDone: () => Promise<DoneView>;
  answer: (answer: PromptAnswer) => Promise<void>;
  action: (action: RecoveryAction) => Promise<void>;
}

function harness(world: FakeWorld, clock: ManualClock): Harness {
  const session = createSetupSession(world.deps);
  const views: SetupView[] = [];
  session.subscribe(() => {
    views.push(session.getView());
  });
  // Views are matched in publish order, so short-lived ones are not missed.
  let cursor = 0;
  const until = async (predicate: (view: SetupView) => boolean) => {
    let found: SetupView | undefined;
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
  const settled = async () =>
    until((view) => view.kind === "failed" || view.kind === "done");
  const answer = async (reply: PromptAnswer) => {
    session.respond(reply);
    await flushPromises();
  };
  const flow: Harness = {
    clock,
    world,
    session,
    views,
    view: () => session.getView(),
    until,
    untilPrompt: async <Kind extends Prompt["kind"]>(kind: Kind) => {
      const view = await until(
        (candidate) =>
          candidate.kind === "prompt" && candidate.prompt.kind === kind,
      );
      if (view.kind !== "prompt") {
        throw new Error(`Expected the ${kind} prompt`);
      }
      return view.prompt as Extract<Prompt, { kind: Kind }>;
    },
    untilFailed: async (tag) => {
      const view = await settled();
      if (view.kind !== "failed") {
        throw new Error(`Expected ${tag}, got done`);
      }
      expect(view.error.name).toBe(tag);
      return view;
    },
    untilWorking: async (step, detail) =>
      until(
        (view) =>
          view.kind === "working" &&
          view.step === step &&
          (detail === undefined || view.detail.kind === detail),
      ),
    untilDone: async () => {
      const view = await settled();
      if (view.kind !== "done") {
        throw new Error(`Expected done, got ${viewName(view)}`);
      }
      return view;
    },
    answer,
    action: async (action) => answer({ kind: "action", action }),
  };
  session.start();
  return flow;
}

function scenario(name: ScenarioName): Harness {
  const clock = new ManualClock();
  return harness(createScenario(name, clock), clock);
}

function custom(
  name: ScenarioName,
  change: (config: FakeWorldConfig) => FakeWorldConfig,
): Harness {
  const clock = new ManualClock();
  return harness(new FakeWorld(change(scenarios[name].config()), clock), clock);
}

/** Rationale → credentials prompt. */
async function toCredentials(flow: Harness) {
  await flow.untilPrompt("rationale");
  await flow.answer({ kind: "continue" });
  return flow.untilPrompt("credentials");
}

async function submit(
  flow: Harness,
  ssid = HOME_SSID,
  password = HOME_PASSWORD,
) {
  await flow.answer({ kind: "credentials", ssid, password });
}

function viewName(view: SetupView): string {
  if (view.kind === "working") {
    return view.step;
  }
  if (view.kind === "prompt") {
    return `prompt:${view.prompt.kind}`;
  }
  if (view.kind === "failed") {
    return `failed:${view.error.name}`;
  }
  return "done";
}

/** Working steps, prompts and outcomes in the order they were shown, without repeats. */
function trail(views: readonly SetupView[]): string[] {
  const names = views.map(viewName);
  return names.filter((name, index) => name !== names[index - 1]);
}

function sendCredentialsCalls(world: FakeWorld): number {
  return world.calls.filter((call) => call.method === "sendCredentials").length;
}

const WRONG_PASSWORD = "wrong-password-xyz";

// ---------------------------------------------------------------------------

describe("session scenarios", () => {
  it("S01 happy path: factory-reset speaker, WPA2", async () => {
    const flow = scenario("happyPath");
    const prompt = await toCredentials(flow);
    expect(prompt.suggested).toBe(HOME_SSID);

    await submit(flow);
    const done = await flow.untilDone();

    const speaker = flow.world.speaker(TARGET_ID);
    expect(done).toEqual({
      kind: "done",
      speaker: {
        deviceID: TARGET_ID,
        name: speaker.config.name,
        type: speaker.config.type,
        ssid: speaker.setupSsid,
        bssid: speaker.config.bssid,
      },
      host: TARGET_HOME_IP,
    });
    expect(trail(flow.views)).toEqual([
      "prompt:rationale",
      "preflight",
      "findSpeaker",
      "join",
      "credentials",
      "prompt:credentials",
      "deliver",
      "leaveSetup",
      "rejoinHome",
      "verify",
      "done",
    ]);
    expect(speaker.profiles).toEqual([
      { ssid: HOME_SSID, password: HOME_PASSWORD },
    ]);
    expect(speaker.setupState).toBe("SETUP_INACTIVE");
    expect(speaker.leaves).toEqual(["link"]);
    expect(flow.world.wifi.releaseCount).toBe(1);
    await flow.session.cancel();
    expect(flow.world.wifi.releaseCount).toBe(1);
  });

  it("S02 two setup networks: chooseSpeaker, join uses the chosen BSSID", async () => {
    const flow = scenario("twoSpeakers");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    const prompt = await flow.untilPrompt("chooseSpeaker");
    const second = flow.world.speaker(SECOND_ID);
    expect(prompt.speakers.map((speaker) => speaker.bssid)).toEqual([
      flow.world.speaker(TARGET_ID).config.bssid,
      second.config.bssid,
    ]);

    await flow.answer({ kind: "chooseSpeaker", bssid: second.config.bssid });
    await flow.untilPrompt("credentials");
    await submit(flow);
    const done = await flow.untilDone();

    expect(flow.world.wifi.joins).toEqual([
      { ssid: second.setupSsid, bssid: second.config.bssid },
    ]);
    expect(done.speaker.deviceID).toBe(SECOND_ID);
    expect(done.host).toBe(second.config.homeIp);
  });

  it("S03 permission denied, can ask again: requestPermission then granting continues", async () => {
    const flow = scenario("permissionDenied");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    const failed = await flow.untilFailed("PermissionDenied");
    expect(failed.actions).toEqual(["requestPermission", "startOver"]);

    flow.world.permissions.onRequest = {
      granted: true,
      fine: true,
      canAskAgain: true,
    };
    await flow.action("requestPermission");

    await flow.untilPrompt("credentials");
    expect(flow.world.permissions.requests).toBe(2);
  });

  it("S04 permission permanently denied: openAppSettings, retry after granting continues", async () => {
    const flow = scenario("permissionBlocked");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    const failed = await flow.untilFailed("PermissionDenied");
    expect(failed.actions).toContain("openAppSettings");
    expect(failed.actions).not.toContain("requestPermission");

    await flow.action("openAppSettings");
    expect(flow.world.permissions.appSettingsOpened).toBe(1);
    expect(flow.view()).toBe(failed);

    flow.world.permissions.state = {
      granted: true,
      fine: true,
      canAskAgain: true,
    };
    await flow.action("retry");
    await flow.untilPrompt("credentials");
  });

  it("S05 coarse location only: PermissionCoarse", async () => {
    const flow = scenario("coarseLocation");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    const failed = await flow.untilFailed("PermissionCoarse");
    expect(failed.actions).toEqual(["openAppSettings", "retry"]);
  });

  it("S06 location services off: enabling them + retry continues", async () => {
    const flow = scenario("locationServicesOff");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    const failed = await flow.untilFailed("LocationServicesOff");
    expect(failed.actions).toEqual(["openLocationSettings", "retry"]);

    await flow.action("openLocationSettings");
    expect(flow.world.permissions.locationSettingsOpened).toBe(1);
    flow.world.permissions.servicesEnabled = true;
    await flow.action("retry");
    await flow.untilPrompt("credentials");
  });

  it("S07 Wi-Fi off, turned on later: continues with no user action", async () => {
    const flow = scenario("wifiOff");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    await flow.untilWorking("preflight", "wifiOff");

    await flow.action("openWifiPanel");
    expect(flow.world.wifi.panelOpened).toBe(1);
    await flow.clock.advance(60_000);
    expect(viewName(flow.view())).toBe("preflight");

    flow.world.wifi.setEnabled(true);
    const prompt = await flow.untilPrompt("credentials");

    expect(prompt.suggested).toBe(HOME_SSID);
    expect(flow.views.some((view) => view.kind === "failed")).toBe(false);
  });

  it("S08 speaker appears on the 3rd scan: continues automatically", async () => {
    const flow = scenario("speakerOnThirdScan");
    await toCredentials(flow);

    const attempts = flow.views.flatMap((view) =>
      view.kind === "working" && view.detail.kind === "scanning"
        ? [view.detail.attempt]
        : [],
    );
    expect(attempts).toEqual([1, 2, 3]);
    expect(flow.views.some((view) => view.kind === "failed")).toBe(false);
  });

  describe("S09 scan throttled (fresh: false)", () => {
    it("uses cached results", async () => {
      const flow = scenario("scanThrottled");
      await flow.untilPrompt("rationale");
      await flow.answer({ kind: "continue" });
      await flow.untilWorking("join");

      expect(flow.world.wifi.joins).toEqual([
        {
          ssid: flow.world.speaker(TARGET_ID).setupSsid,
          bssid: flow.world.speaker(TARGET_ID).config.bssid,
        },
      ]);
    });

    it("spaces scan calls by SCAN_INTERVAL_MS over virtual time", async () => {
      const flow = custom("scanThrottled", (config) => ({
        ...config,
        scan: { throttled: true, cached: [] },
      }));
      await flow.untilPrompt("rationale");
      await flow.answer({ kind: "continue" });
      await flow.untilWorking("findSpeaker");
      await flow.clock.advance(4 * SCAN_INTERVAL_MS);

      const times = flow.world.wifi.scanTimes;
      expect(times).toHaveLength(5);
      expect(times.slice(1).map((time, index) => time - times[index])).toEqual(
        Array.from({ length: 4 }, () => SCAN_INTERVAL_MS),
      );

      flow.world.wifi.throttled = false;
      await flow.untilPrompt("credentials");
    });
  });

  it("S10 approval dialog cancelled: retry / manualJoin / startOver; retry joins", async () => {
    const flow = scenario("approvalCancelled");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    const failed = await flow.untilFailed("JoinRejected");
    expect(failed.actions).toEqual(["retry", "manualJoin", "startOver"]);

    await flow.action("retry");
    await flow.untilPrompt("credentials");
    expect(flow.world.wifi.joins).toHaveLength(2);
  });

  describe("S11 /info silent after join", () => {
    it("silent for 5 s: succeeds", async () => {
      const flow = scenario("slowSpeaker");
      await toCredentials(flow);
      expect(flow.views.some((view) => view.kind === "failed")).toBe(false);
    });

    it("silent for the whole JOIN_PROBE_BUDGET_MS: SpeakerUnreachable", async () => {
      const flow = scenario("silentSpeaker");
      await flow.untilPrompt("rationale");
      await flow.answer({ kind: "continue" });
      await flow.untilWorking("join", "probing");
      const probingSince = flow.clock.now();

      const failed = await flow.untilFailed("SpeakerUnreachable");

      const elapsed = flow.clock.now() - probingSince;
      expect(elapsed).toBeGreaterThanOrEqual(JOIN_PROBE_BUDGET_MS);
      expect(elapsed).toBeLessThan(JOIN_PROBE_BUDGET_MS + PROBE_TIMEOUT_MS);
      expect(SpeakerUnreachable.is(failed.error) && failed.error.reason).toBe(
        "noAnswer",
      );
    });
  });

  it("S12 manual join: prompt → bindToConnectedWifi → probe → credentials; not connected → ManualJoinNotConnected", async () => {
    const flow = scenario("approvalCancelled");
    await flow.untilPrompt("rationale");
    await flow.answer({ kind: "continue" });
    await flow.untilFailed("JoinRejected");
    await flow.action("manualJoin");
    await flow.untilPrompt("manualJoin");

    await flow.answer({ kind: "manualJoin", connected: true });
    const failed = await flow.untilFailed("ManualJoinNotConnected");
    expect(failed.actions).toEqual(["openWifiSettings", "retry"]);

    await flow.action("openWifiSettings");
    expect(flow.world.wifi.settingsOpened).toBe(1);
    await flow.untilPrompt("manualJoin");
    flow.world.wifi.manualConnection =
      flow.world.speaker(TARGET_ID).config.bssid;
    await flow.answer({ kind: "manualJoin", connected: true });

    await flow.untilPrompt("credentials");
    expect(flow.world.wifi.joins).toHaveLength(1);
  });

  it("S13 cancel during a pending join, then a new session completes", async () => {
    const clock = new ManualClock();
    const world = new FakeWorld(
      { ...scenarios.happyPath.config(), join: { outcomes: ["hang", "ok"] } },
      clock,
    );
    const first = harness(world, clock);
    await first.untilPrompt("rationale");
    await first.answer({ kind: "continue" });
    await first.untilWorking("join", "joining");
    expect(world.wifi.pendingJoins).toBe(1);

    await first.session.cancel();

    expect(world.wifi.pendingJoins).toBe(0);
    expect(world.wifi.releaseCount).toBe(1);

    const second = harness(world, clock);
    await toCredentials(second);
    await submit(second);
    const done = await second.untilDone();

    expect(done.speaker.deviceID).toBe(TARGET_ID);
    expect(world.wifi.releaseCount).toBe(2);
  });

  describe("S14 link lost during the credentials prompt", () => {
    it("restored within LINK_RESTORE_MS: the answer is still delivered", async () => {
      const flow = scenario("happyPath");
      await toCredentials(flow);
      flow.world.wifi.loseLink();
      await flow.clock.advance(10_000);
      flow.world.wifi.restoreLink();
      await flow.clock.advance(10_000);
      expect(viewName(flow.view())).toBe("prompt:credentials");

      await submit(flow);
      await flow.untilDone();
      expect(flow.world.wifi.joins).toHaveLength(1);
    });

    it("not restored: LinkLost; retry rejoins and shows the prompt again", async () => {
      const flow = scenario("happyPath");
      await toCredentials(flow);
      flow.world.wifi.loseLink();

      const failed = await flow.untilFailed("LinkLost");
      expect(failed.actions).toEqual(["retry"]);
      await flow.action("retry");

      const prompt = await flow.untilPrompt("credentials");
      expect(prompt.suggested).toBe(HOME_SSID);
      expect(flow.world.wifi.joins).toHaveLength(2);
    });

    it("lost while delivering: retry keeps the typed SSID", async () => {
      const flow = scenario("happyPath");
      await toCredentials(flow);
      await submit(flow, OFFICE_SSID, OFFICE_PASSWORD);
      await flow.untilWorking("deliver", "delivering");
      flow.world.wifi.loseLink();

      await flow.untilFailed("LinkLost");
      await flow.action("retry");

      const prompt = await flow.untilPrompt("credentials");
      expect(prompt.suggested).toBe(OFFICE_SSID);
    });
  });

  it("S15 open home network: no password; sendCredentials gets an empty password", async () => {
    const flow = scenario("openHomeNetwork");
    const prompt = await toCredentials(flow);
    expect(prompt.suggested).toBe(OPEN_SSID);
    expect(
      prompt.networks.find((network) => network.ssid === OPEN_SSID)?.security,
    ).toBe("open");

    await submit(flow, OPEN_SSID, "");
    await flow.untilDone();

    expect(flow.world.speaker(TARGET_ID).profiles).toEqual([
      { ssid: OPEN_SSID, password: "" },
    ]);
  });

  it("S16 home SSID suggested; a 5 GHz-only network is selectable", async () => {
    const flow = scenario("happyPath");
    const prompt = await toCredentials(flow);
    expect(prompt.suggested).toBe(HOME_SSID);
    expect(prompt.networks).toContainEqual(
      expect.objectContaining({ ssid: HOME_SSID, bands: ["2.4GHz", "5GHz"] }),
    );
    expect(prompt.networks).toContainEqual(
      expect.objectContaining({ ssid: OFFICE_SSID, bands: ["5GHz"] }),
    );

    await submit(flow, OFFICE_SSID, OFFICE_PASSWORD);
    const delivering = await flow.untilWorking("deliver", "delivering");
    await flow.untilWorking("rejoinHome");

    expect(delivering).toMatchObject({ detail: { ssid: OFFICE_SSID } });
    expect(flow.world.speaker(TARGET_ID).station?.ssid).toBe(OFFICE_SSID);
  });

  it("S16b speaker set up for another network: the phone staying on its own Wi-Fi counts as rejoined", async () => {
    const flow = scenario("happyPath");
    await toCredentials(flow);
    await submit(flow, OFFICE_SSID, OFFICE_PASSWORD);
    await flow.untilWorking("rejoinHome");
    const waitingSince = flow.clock.now();

    await flow.untilWorking("verify");

    expect(flow.world.wifi.network).toMatchObject({ ssid: HOME_SSID });
    expect(flow.clock.now() - waitingSince).toBeLessThan(
      REJOIN_HOME_TIMEOUT_MS,
    );
    expect(flow.views.some((view) => view.kind === "failed")).toBe(false);
  });

  it("S17 wrong password: CredentialsRejected after 35 s; edit on the same link; corrected → done", async () => {
    const flow = scenario("happyPath");
    await toCredentials(flow);
    await submit(flow, HOME_SSID, WRONG_PASSWORD);
    await flow.untilWorking("deliver", "delivering");
    const sentAt = flow.clock.now();

    const failed = await flow.untilFailed("CredentialsRejected");
    expect(flow.clock.now() - sentAt).toBeGreaterThanOrEqual(35_000);
    expect(failed.actions).toEqual(["editCredentials"]);

    await flow.action("editCredentials");
    const prompt = await flow.untilPrompt("credentials");
    expect(prompt).toMatchObject({ reason: "rejected", suggested: HOME_SSID });

    await submit(flow);
    const done = await flow.untilDone();

    expect(done.speaker.deviceID).toBe(TARGET_ID);
    expect(flow.world.wifi.joins).toHaveLength(1);
    expect(flow.world.speaker(TARGET_ID).profiles).toHaveLength(2);
  });

  describe("S18 addWirelessProfile never replies", () => {
    it("aborted at DELIVER_TIMEOUT_MS; wlan0 on the home SSID with an address → continues", async () => {
      const flow = scenario("profileNeverReplies");
      await toCredentials(flow);
      await submit(flow);
      await flow.untilWorking("deliver", "delivering");
      const sentAt = flow.clock.now();
      await flow.untilWorking("deliver", "confirming");
      expect(flow.clock.now() - sentAt).toBe(DELIVER_TIMEOUT_MS);

      const done = await flow.untilDone();

      expect(done.host).toBe(TARGET_HOME_IP);
      expect(flow.views.some((view) => view.kind === "failed")).toBe(false);
    });

    it("otherwise DeliveryFailed", async () => {
      const flow = scenario("profileNeverReplies");
      await toCredentials(flow);
      await submit(flow, HOME_SSID, WRONG_PASSWORD);

      const failed = await flow.untilFailed("DeliveryFailed");

      expect(failed.actions).toEqual(["retry", "editCredentials"]);
    });
  });

  it("S19 NetworkError from addWirelessProfile and link probes fail: LinkLost, not success", async () => {
    const flow = scenario("linkDropsOnSend");
    await toCredentials(flow);
    await submit(flow);

    await flow.untilFailed("LinkLost");

    expect(trail(flow.views)).not.toContain("leaveSetup");
  });

  describe("S20 other ApiError / HttpError", () => {
    it.each(["otherApiError", "httpError"] as const)(
      "%s: DeliveryFailed with retry / editCredentials; no automatic resend",
      async (name) => {
        const flow = scenario(name);
        await toCredentials(flow);
        await submit(flow);

        const failed = await flow.untilFailed("DeliveryFailed");
        expect(failed.actions).toEqual(["retry", "editCredentials"]);
        await flow.clock.advance(5 * 60_000);
        expect(sendCredentialsCalls(flow.world)).toBe(1);

        await flow.action("retry");
        await flow.untilFailed("DeliveryFailed");
        expect(sendCredentialsCalls(flow.world)).toBe(2);

        await flow.action("editCredentials");
        const prompt = await flow.untilPrompt("credentials");
        expect(prompt.reason).toBeUndefined();
      },
    );
  });

  it("S21 networkInfo has no wlan0 address: verify falls back to mDNS", async () => {
    const flow = scenario("noWlan0Address");
    await toCredentials(flow);
    await submit(flow);

    const done = await flow.untilDone();

    expect(done.host).toBe(TARGET_HOME_IP);
    expect(flow.world.calls.some((call) => call.method === "browse")).toBe(
      true,
    );
  });

  it("S22 leaveSetup over the link fails: verify sends SETUP_LEAVE on the home address", async () => {
    const flow = scenario("leaveOverLinkFails");
    await toCredentials(flow);
    await submit(flow);

    await flow.untilDone();

    const speaker = flow.world.speaker(TARGET_ID);
    expect(speaker.leaves).toEqual(["home"]);
    expect(speaker.setupState).toBe("SETUP_INACTIVE");
  });

  describe("S23 phone lost home Wi-Fi after release", () => {
    it("restored: waits, then verifies", async () => {
      const flow = scenario("phoneLosesHomeWifi");
      await toCredentials(flow);
      await submit(flow);
      await flow.untilWorking("rejoinHome");
      expect(flow.world.wifi.network.transport).toBe("cellular");

      await flow.untilDone();
      expect(flow.views.some((view) => view.kind === "failed")).toBe(false);
    });

    it("never restored: HomeWifiNotRestored; continueAnyway → verify", async () => {
      const flow = scenario("phoneStaysOffWifi");
      await toCredentials(flow);
      await submit(flow);
      await flow.untilWorking("rejoinHome");
      const waitingSince = flow.clock.now();

      const failed = await flow.untilFailed("HomeWifiNotRestored");
      expect(flow.clock.now() - waitingSince).toBe(REJOIN_HOME_TIMEOUT_MS);
      expect(failed.actions).toEqual(["openWifiSettings", "continueAnyway"]);

      await flow.action("continueAnyway");
      await flow.untilWorking("verify");
      flow.world.wifi.setNetwork({ transport: "wifi", ssid: HOME_SSID });
      await flow.untilDone();
    });

    it("never restored: openWifiSettings → waits again", async () => {
      const flow = scenario("phoneStaysOffWifi");
      await toCredentials(flow);
      await submit(flow);
      await flow.untilFailed("HomeWifiNotRestored");

      await flow.action("openWifiSettings");
      expect(flow.world.wifi.settingsOpened).toBe(1);
      await flow.untilWorking("rejoinHome");
      flow.world.wifi.setNetwork({ transport: "wifi", ssid: HOME_SSID });
      await flow.untilDone();
    });
  });

  it("S24 another SoundTouch announces first (different TXT MAC): ignored", async () => {
    const flow = scenario("otherSpeakerAnnouncesFirst");
    await toCredentials(flow);
    expect(flow.world.announcements()[0].mac).toBe(OTHER_ID);
    await submit(flow);

    const done = await flow.untilDone();

    expect(done.speaker.deviceID).toBe(TARGET_ID);
    expect(done.host).toBe(TARGET_HOME_IP);
  });

  it("S25 home address silent for 8 s after SETUP_LEAVE: verify keeps polling", async () => {
    const flow = scenario("homeSilentAfterLeave");
    await toCredentials(flow);
    await submit(flow);
    await flow.untilWorking("leaveSetup");
    const leftAt = flow.clock.now();

    const done = await flow.untilDone();

    expect(flow.clock.now() - leftAt).toBeGreaterThanOrEqual(8000);
    expect(done.host).toBe(TARGET_HOME_IP);
  });

  it("S26 verify timeout: NotVerified; enterIp with the wrong device stays failed; matching → done", async () => {
    const flow = custom("speakerNeverShowsUp", (config) => ({
      ...config,
      speakers: [
        targetSpeaker({
          deviceID: OTHER_ID,
          bssid: "00:11:22:dd:ee:ff",
          homeIp: "192.168.1.30",
          setupMode: false,
          preconfigured: { ssid: HOME_SSID },
        }),
        ...config.speakers,
      ],
    }));
    await toCredentials(flow);
    await submit(flow);
    await flow.untilWorking("verify");
    const verifyingSince = flow.clock.now();

    const failed = await flow.untilFailed("NotVerified");
    expect(flow.clock.now() - verifyingSince).toBe(VERIFY_TIMEOUT_MS);
    expect(failed.actions).toEqual(["retry", "enterIp", "startOver"]);

    await flow.answer({ kind: "enterIp", ip: "192.168.1.30" });
    const wrong = await flow.untilFailed("NotVerified");
    expect(NotVerified.is(wrong.error) && wrong.error.ip).toBe("192.168.1.30");

    await flow.answer({ kind: "enterIp", ip: TARGET_HOME_IP });
    const done = await flow.untilDone();
    expect(done).toMatchObject({
      speaker: { deviceID: TARGET_ID },
      host: TARGET_HOME_IP,
    });
  });

  it("S27 already-configured speaker: answering on the home network before deliver does not end the session", async () => {
    const flow = scenario("reconfiguredSpeaker");
    await toCredentials(flow);
    expect(flow.world.announcements().map((service) => service.mac)).toEqual([
      TARGET_ID,
    ]);

    await submit(flow, HOME_SSID, WRONG_PASSWORD);
    await flow.untilFailed("CredentialsRejected");
    expect(trail(flow.views)).not.toContain("done");

    await flow.action("editCredentials");
    await flow.untilPrompt("credentials");
    await submit(flow);
    const done = await flow.untilDone();
    expect(done.speaker.deviceID).toBe(TARGET_ID);
  });

  describe("S28 cancel() at every step", () => {
    const points: [string, () => Promise<Harness>][] = [
      [
        "rationale prompt",
        async () => {
          const flow = scenario("happyPath");
          await flow.untilPrompt("rationale");
          return flow;
        },
      ],
      [
        "permission dialog open",
        async () => {
          const flow = custom("permissionDenied", (config) => ({
            ...config,
            permissions: {
              granted: false,
              fine: false,
              dialogMs: 60_000,
              onRequest: { granted: true, fine: true, canAskAgain: true },
            },
          }));
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilWorking("preflight", "checkingPermissions");
          return flow;
        },
      ],
      [
        "Wi-Fi off",
        async () => {
          const flow = scenario("wifiOff");
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilWorking("preflight", "wifiOff");
          return flow;
        },
      ],
      [
        "scanning",
        async () => {
          const flow = custom("happyPath", (config) => ({
            ...config,
            scan: { missSetupScans: 1000 },
          }));
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilWorking("findSpeaker");
          await flow.clock.advance(2 * SCAN_INTERVAL_MS);
          return flow;
        },
      ],
      [
        "chooseSpeaker prompt",
        async () => {
          const flow = scenario("twoSpeakers");
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilPrompt("chooseSpeaker");
          return flow;
        },
      ],
      [
        "join pending",
        async () => {
          const flow = scenario("joinHangs");
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilWorking("join", "joining");
          return flow;
        },
      ],
      [
        "probing",
        async () => {
          const flow = scenario("silentSpeaker");
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilWorking("join", "probing");
          return flow;
        },
      ],
      [
        "join failed",
        async () => {
          const flow = scenario("approvalCancelled");
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilFailed("JoinRejected");
          return flow;
        },
      ],
      [
        "manualJoin prompt",
        async () => {
          const flow = scenario("approvalCancelled");
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          await flow.untilFailed("JoinRejected");
          await flow.action("manualJoin");
          await flow.untilPrompt("manualJoin");
          return flow;
        },
      ],
      [
        "credentials prompt",
        async () => {
          const flow = scenario("happyPath");
          await toCredentials(flow);
          return flow;
        },
      ],
      [
        "delivering",
        async () => {
          const flow = scenario("happyPath");
          await toCredentials(flow);
          await submit(flow);
          await flow.untilWorking("deliver", "delivering");
          return flow;
        },
      ],
      [
        "confirming after a transport error",
        async () => {
          const flow = scenario("linkDropsOnSend");
          await toCredentials(flow);
          await submit(flow);
          await flow.untilWorking("deliver", "confirming");
          return flow;
        },
      ],
      [
        "credentials rejected",
        async () => {
          const flow = scenario("happyPath");
          await toCredentials(flow);
          await submit(flow, HOME_SSID, WRONG_PASSWORD);
          await flow.untilFailed("CredentialsRejected");
          return flow;
        },
      ],
      [
        "leaving setup",
        async () => {
          const flow = custom("happyPath", (config) => ({
            ...config,
            speakers: [targetSpeaker({ leaveOverLink: "hangs" })],
          }));
          await toCredentials(flow);
          await submit(flow);
          await flow.untilWorking("leaveSetup");
          return flow;
        },
      ],
      [
        "waiting for home Wi-Fi",
        async () => {
          const flow = scenario("phoneStaysOffWifi");
          await toCredentials(flow);
          await submit(flow);
          await flow.untilWorking("rejoinHome");
          return flow;
        },
      ],
      [
        "verifying",
        async () => {
          const flow = scenario("speakerNeverShowsUp");
          await toCredentials(flow);
          await submit(flow);
          await flow.untilWorking("verify");
          await flow.clock.advance(10_000);
          return flow;
        },
      ],
      [
        "done",
        async () => {
          const flow = scenario("happyPath");
          await toCredentials(flow);
          await submit(flow);
          await flow.untilDone();
          return flow;
        },
      ],
    ];

    it.each(points)(
      "%s: release exactly once; no port calls or views after cancel",
      async (_point, reach) => {
        const flow = await reach();

        await flow.session.cancel();

        expect(flow.world.wifi.releaseCount).toBe(1);
        expect(flow.world.wifi.pendingJoins).toBe(0);
        const calls = flow.world.calls.length;
        const views = flow.views.length;
        const view = flow.view();
        await flow.clock.advance(10 * 60_000);
        for (const action of [
          "retry",
          "startOver",
          "editCredentials",
          "openWifiPanel",
        ] as const) {
          await flow.action(action);
        }
        await flow.answer({ kind: "continue" });
        await submit(flow);
        await flow.session.cancel();
        expect(flow.world.calls).toHaveLength(calls);
        expect(flow.views).toHaveLength(views);
        expect(flow.view()).toBe(view);
        expect(flow.world.wifi.releaseCount).toBe(1);
      },
    );
  });

  describe("S29 every error kind: actions lead to a defined step", () => {
    type Next = { working: StepId } | { prompt: Prompt["kind"] } | "stays";
    interface ErrorCase {
      tag: string;
      reach: () => Promise<Harness>;
      next: Partial<Record<RecoveryAction, Next>>;
    }

    const afterRationale = async (name: ScenarioName) => {
      const flow = scenario(name);
      await flow.untilPrompt("rationale");
      await flow.answer({ kind: "continue" });
      return flow;
    };
    const afterSubmit = async (
      name: ScenarioName,
      password = HOME_PASSWORD,
    ) => {
      const flow = scenario(name);
      await toCredentials(flow);
      await submit(flow, HOME_SSID, password);
      return flow;
    };

    const cases: ErrorCase[] = [
      {
        tag: "PermissionDenied",
        reach: async () => afterRationale("permissionDenied"),
        next: {
          requestPermission: { working: "preflight" },
          startOver: { working: "preflight" },
        },
      },
      {
        tag: "PermissionDenied",
        reach: async () => afterRationale("permissionBlocked"),
        next: {
          openAppSettings: "stays",
          retry: { working: "preflight" },
          startOver: { working: "preflight" },
        },
      },
      {
        tag: "PermissionCoarse",
        reach: async () => afterRationale("coarseLocation"),
        next: { openAppSettings: "stays", retry: { working: "preflight" } },
      },
      {
        tag: "LocationServicesOff",
        reach: async () => afterRationale("locationServicesOff"),
        next: {
          openLocationSettings: "stays",
          retry: { working: "preflight" },
        },
      },
      {
        tag: "JoinRejected",
        reach: async () => afterRationale("approvalCancelled"),
        next: {
          retry: { working: "join" },
          manualJoin: { prompt: "manualJoin" },
          startOver: { working: "findSpeaker" },
        },
      },
      {
        tag: "JoinTimeout",
        reach: async () => afterRationale("joinHangs"),
        next: {
          retry: { working: "join" },
          manualJoin: { prompt: "manualJoin" },
          startOver: { working: "findSpeaker" },
        },
      },
      {
        tag: "SpeakerUnreachable",
        reach: async () => afterRationale("silentSpeaker"),
        next: {
          retry: { working: "join" },
          manualJoin: { prompt: "manualJoin" },
        },
      },
      {
        tag: "ManualJoinNotConnected",
        reach: async () => {
          const flow = await afterRationale("approvalCancelled");
          await flow.untilFailed("JoinRejected");
          await flow.action("manualJoin");
          await flow.untilPrompt("manualJoin");
          await flow.answer({ kind: "manualJoin", connected: true });
          return flow;
        },
        next: {
          openWifiSettings: { prompt: "manualJoin" },
          retry: { prompt: "manualJoin" },
        },
      },
      {
        tag: "LinkLost",
        reach: async () => {
          const flow = scenario("happyPath");
          await toCredentials(flow);
          flow.world.wifi.loseLink();
          return flow;
        },
        next: { retry: { working: "join" } },
      },
      {
        tag: "CredentialsRejected",
        reach: async () => afterSubmit("happyPath", WRONG_PASSWORD),
        next: { editCredentials: { working: "credentials" } },
      },
      {
        tag: "DeliveryFailed",
        reach: async () => afterSubmit("otherApiError"),
        next: {
          retry: { working: "deliver" },
          editCredentials: { working: "credentials" },
        },
      },
      {
        tag: "HomeWifiNotRestored",
        reach: async () => afterSubmit("phoneStaysOffWifi"),
        next: {
          openWifiSettings: { working: "rejoinHome" },
          continueAnyway: { working: "verify" },
        },
      },
      {
        tag: "NotVerified",
        reach: async () => afterSubmit("speakerNeverShowsUp"),
        next: {
          retry: { working: "verify" },
          enterIp: { working: "verify" },
          startOver: { working: "findSpeaker" },
        },
      },
      {
        tag: "UnexpectedError",
        reach: async () => {
          const flow = scenario("happyPath");
          flow.world.wifi.failNextScans = 1;
          await flow.untilPrompt("rationale");
          await flow.answer({ kind: "continue" });
          return flow;
        },
        next: {
          retry: { working: "findSpeaker" },
          startOver: { working: "findSpeaker" },
        },
      },
    ];

    it("covers every SetupError kind", () => {
      expect(new Set(cases.map((entry) => entry.tag))).toEqual(
        new Set([
          "PermissionDenied",
          "PermissionCoarse",
          "LocationServicesOff",
          "JoinRejected",
          "JoinTimeout",
          "SpeakerUnreachable",
          "ManualJoinNotConnected",
          "LinkLost",
          "CredentialsRejected",
          "DeliveryFailed",
          "HomeWifiNotRestored",
          "NotVerified",
          "UnexpectedError",
        ]),
      );
    });

    const rows = cases.flatMap((entry) =>
      Object.entries(entry.next).map(
        ([action, next]) =>
          [entry.tag, action as RecoveryAction, entry, next] as const,
      ),
    );

    it.each(cases.map((entry) => [entry.tag, entry] as const))(
      "%s offers exactly the tested actions",
      async (tag, entry) => {
        const flow = await entry.reach();
        const failed = await flow.untilFailed(tag);
        expect(failed.actions.length).toBeGreaterThan(0);
        expect(failed.actions.toSorted()).toEqual(
          Object.keys(entry.next).toSorted(),
        );
      },
    );

    it.each(rows)("%s → %s", async (tag, action, entry, next) => {
      const flow = await entry.reach();
      const failed = await flow.untilFailed(tag);
      const shown = flow.views.length;

      await (action === "enterIp"
        ? flow.answer({ kind: "enterIp", ip: TARGET_HOME_IP })
        : flow.action(action));

      if (next === "stays") {
        expect(flow.views).toHaveLength(shown);
        expect(flow.view()).toBe(failed);
        return;
      }
      const following = flow.views[shown];
      expect(following).toBeDefined();
      expect(following).toMatchObject(
        "working" in next
          ? { kind: "working", step: next.working }
          : { kind: "prompt", prompt: { kind: next.prompt } },
      );
    });
  });

  it("S30 the password never reaches a Log event or a published view", async () => {
    const flows: [ScenarioName, (flow: Harness) => Promise<void>][] = [
      [
        "happyPath",
        async (flow) => {
          await toCredentials(flow);
          await submit(flow);
          await flow.untilDone();
        },
      ],
      [
        "happyPath",
        async (flow) => {
          await toCredentials(flow);
          await submit(flow, HOME_SSID, WRONG_PASSWORD);
          await flow.untilFailed("CredentialsRejected");
          await flow.action("editCredentials");
          await flow.untilPrompt("credentials");
          await submit(flow);
          await flow.untilDone();
        },
      ],
      [
        "profileNeverReplies",
        async (flow) => {
          await toCredentials(flow);
          await submit(flow);
          await flow.untilDone();
        },
      ],
      [
        "otherApiError",
        async (flow) => {
          await toCredentials(flow);
          await submit(flow);
          await flow.untilFailed("DeliveryFailed");
        },
      ],
    ];
    for (const [name, run] of flows) {
      const flow = scenario(name);
      await run(flow);
      await flow.session.cancel();
      const published = JSON.stringify([flow.views, flow.world.log.events]);
      expect(flow.world.log.events.length).toBeGreaterThan(0);
      expect(published).not.toContain(HOME_PASSWORD);
      expect(published).not.toContain(WRONG_PASSWORD);
    }
  });
});
