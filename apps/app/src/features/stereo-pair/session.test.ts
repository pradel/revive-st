import { Result } from "better-result";
import {
  ApiError,
  type BoseApiError,
  NetworkError,
  type NewGroup,
  type SpeakerGroup,
} from "bose-api-speaker-client";
import { describe, expect, it } from "vite-plus/test";

import { ManualClock, MemoryLog } from "../onboarding/session/testing/fakes";
import type { ServerCheck } from "../server/server-version";
import {
  createPairSession,
  GROUP_ALREADY_EXISTS,
  GROUP_NOT_STORED,
  PAIR_BUDGET_MS,
  type PairDeps,
  type PairMember,
  type PairTarget,
  type PairView,
} from "./session";

const LEFT: PairMember = {
  deviceID: "0CAE7D6298E9",
  name: "Living room",
  host: "192.168.1.195",
  port: 8090,
};
const RIGHT: PairMember = {
  deviceID: "EC1127C25A50",
  name: "Office",
  host: "192.168.1.189",
  port: 8090,
};
const TARGET: PairTarget = {
  name: "Living room + Office",
  left: LEFT,
  right: RIGHT,
};
/** The id our server gives the pair; the master adopts it. */
const PAIR_ID = "3271058";

const apiError = (value: number) =>
  new ApiError({
    deviceID: LEFT.deviceID,
    errors: [{ value, name: String(value), severity: "Unknown", message: "" }],
    rawXml: "",
  });

/** What a speaker reports once in `group`, as `/getGroup` answers it. */
const reported = (group: NewGroup, id: string): SpeakerGroup => ({
  id,
  ...group,
  senderIpAddress: LEFT.host,
  status: "GROUP_OK",
});

/**
 * Two SoundTouch 10s and our server, answering after 100 ms of `clock`
 * time. Like the firmware, `/addGroup` to the master pairs both (unless
 * `partnerJoins` is false), and `/removeGroup` to either clears its pair
 * from both.
 */
class FakePairWorld {
  readonly clock = new ManualClock();
  readonly log = new MemoryLog();
  readonly calls: string[] = [];
  readonly groups = new Map<string, SpeakerGroup | null>([
    [LEFT.deviceID, null],
    [RIGHT.deviceID, null],
  ]);
  server: ServerCheck = { kind: "supported", version: "0.0.6" };
  /** The partner joins a pair the master forms. */
  partnerJoins = true;
  /** What `/addGroup` answers instead of pairing, once per entry. */
  addFailures: BoseApiError[] = [];
  /** `/removeGroup` reaches only the speaker it's sent to. */
  peerUnreachable = false;
  /** Speakers whose `/getGroup` doesn't answer. */
  readonly unreachable = new Set<string>();

  async #answer<Value>(value: Value, signal: AbortSignal): Promise<Value> {
    await this.clock.sleep(100, signal);
    return value;
  }

  deps(): PairDeps {
    return {
      checkServer: async (signal) =>
        this.#answer(Result.ok(this.server), signal),
      speaker: {
        getGroup: async (member, signal) => {
          this.calls.push(`getGroup ${member.name}`);
          if (this.unreachable.has(member.deviceID)) {
            return this.#answer(
              Result.err(new NetworkError({ message: "Unreachable" })),
              signal,
            );
          }
          return this.#answer(
            Result.ok(this.groups.get(member.deviceID) ?? null),
            signal,
          );
        },
        addGroup: async (member, group, signal) => {
          this.calls.push(`addGroup ${member.name}`);
          const failure = this.addFailures.shift();
          if (failure) {
            return this.#answer(Result.err(failure), signal);
          }
          const formed = reported(group, PAIR_ID);
          this.groups.set(LEFT.deviceID, formed);
          if (this.partnerJoins) {
            this.groups.set(RIGHT.deviceID, formed);
          }
          return this.#answer(Result.ok(formed), signal);
        },
        removeGroup: async (member, signal) => {
          this.calls.push(`removeGroup ${member.name}`);
          // The other speaker keeps its half when it doesn't take the request,
          // and a pair of its own in any case.
          const id = this.groups.get(member.deviceID)?.id;
          for (const speaker of [LEFT, RIGHT]) {
            if (
              speaker.deviceID === member.deviceID ||
              (!this.peerUnreachable &&
                id !== undefined &&
                this.groups.get(speaker.deviceID)?.id === id)
            ) {
              this.groups.set(speaker.deviceID, null);
            }
          }
          return this.#answer(
            Result.ok({ peerUnreachable: this.peerUnreachable }),
            signal,
          );
        },
      },
      clock: this.clock,
      log: this.log,
    };
  }
}

async function pair(world: FakePairWorld): Promise<PairView> {
  const session = createPairSession(world.deps(), TARGET);
  session.start();
  await world.clock.runUntil(() => session.getView().kind !== "working");
  return session.getView();
}

describe("pairing session", () => {
  it("pairs through the master only, once both speakers report the pair", async () => {
    const world = new FakePairWorld();

    const view = await pair(world);

    expect(view).toMatchObject({
      kind: "done",
      group: { id: PAIR_ID, masterDeviceId: LEFT.deviceID },
    });
    expect(world.calls.filter((call) => call.startsWith("addGroup"))).toEqual([
      "addGroup Living room",
    ]);
    expect(world.groups.get(RIGHT.deviceID)).toMatchObject({
      name: "Living room + Office",
      roles: [
        { deviceId: LEFT.deviceID, role: "LEFT", ipAddress: LEFT.host },
        { deviceId: RIGHT.deviceID, role: "RIGHT", ipAddress: RIGHT.host },
      ],
    });
  });

  it("removes a pair left over from before (5510) and pairs again", async () => {
    const world = new FakePairWorld();
    const stale = reported(
      {
        name: "Old pair",
        masterDeviceId: RIGHT.deviceID,
        roles: [
          { deviceId: RIGHT.deviceID, role: "LEFT", ipAddress: RIGHT.host },
          { deviceId: LEFT.deviceID, role: "RIGHT", ipAddress: LEFT.host },
        ],
      },
      "1111111",
    );
    world.groups.set(RIGHT.deviceID, stale);
    world.addFailures = [apiError(GROUP_ALREADY_EXISTS)];

    const view = await pair(world);

    expect(view.kind).toBe("done");
    expect(world.calls.slice(0, 5)).toEqual([
      "addGroup Living room",
      "getGroup Living room",
      "getGroup Office",
      "removeGroup Office",
      "addGroup Living room",
    ]);
  });

  it("removes a stale pair both speakers report through one of them", async () => {
    const world = new FakePairWorld();
    const stale = reported(
      {
        name: "Old pair",
        masterDeviceId: LEFT.deviceID,
        roles: [
          { deviceId: LEFT.deviceID, role: "LEFT", ipAddress: LEFT.host },
          { deviceId: RIGHT.deviceID, role: "RIGHT", ipAddress: RIGHT.host },
        ],
      },
      "1111111",
    );
    world.groups.set(LEFT.deviceID, stale);
    world.groups.set(RIGHT.deviceID, stale);
    world.addFailures = [apiError(GROUP_ALREADY_EXISTS)];

    expect((await pair(world)).kind).toBe("done");
    expect(world.calls.slice(0, 5)).toEqual([
      "addGroup Living room",
      "getGroup Living room",
      "getGroup Office",
      "removeGroup Living room",
      "addGroup Living room",
    ]);
  });

  it("keeps a pair whose speakers it can't tell (5510), and fails", async () => {
    const world = new FakePairWorld();
    const unknown = reported(
      { name: "Old pair", masterDeviceId: RIGHT.deviceID, roles: [] },
      "1111111",
    );
    world.groups.set(RIGHT.deviceID, unknown);
    world.addFailures = [apiError(GROUP_ALREADY_EXISTS)];

    expect(await pair(world)).toEqual({
      kind: "failed",
      step: "pair",
      error: { kind: "alreadyPaired" },
    });
    expect(world.calls).not.toContain("removeGroup Office");
  });

  it("keeps a pair one speaker has with another speaker (5510), and fails", async () => {
    const world = new FakePairWorld();
    const other = reported(
      {
        name: "Office + Kitchen",
        masterDeviceId: RIGHT.deviceID,
        roles: [
          { deviceId: RIGHT.deviceID, role: "LEFT", ipAddress: RIGHT.host },
          { deviceId: "A0F6FD000001", role: "RIGHT", ipAddress: "192.0.2.3" },
        ],
      },
      "2222222",
    );
    world.groups.set(RIGHT.deviceID, other);
    world.addFailures = [apiError(GROUP_ALREADY_EXISTS)];

    expect(await pair(world)).toEqual({
      kind: "failed",
      step: "pair",
      error: { kind: "alreadyPaired" },
    });
    expect(world.calls).not.toContain("removeGroup Office");
    expect(world.groups.get(RIGHT.deviceID)).toBe(other);
  });

  it("gives up after one retry when the speakers still report a pair", async () => {
    const world = new FakePairWorld();
    world.groups.set(
      RIGHT.deviceID,
      reported(
        {
          name: "Old pair",
          masterDeviceId: RIGHT.deviceID,
          roles: [
            { deviceId: RIGHT.deviceID, role: "LEFT", ipAddress: RIGHT.host },
            { deviceId: LEFT.deviceID, role: "RIGHT", ipAddress: LEFT.host },
          ],
        },
        "1111111",
      ),
    );
    world.addFailures = [
      apiError(GROUP_ALREADY_EXISTS),
      apiError(GROUP_ALREADY_EXISTS),
    ];

    expect(await pair(world)).toEqual({
      kind: "failed",
      step: "pair",
      error: { kind: "alreadyPaired" },
    });
    expect(world.calls.filter((call) => call.startsWith("addGroup"))).toEqual([
      "addGroup Living room",
      "addGroup Living room",
    ]);
  });

  it("tells our server couldn't store the pair (5580)", async () => {
    const world = new FakePairWorld();
    world.addFailures = [apiError(GROUP_NOT_STORED)];

    expect(await pair(world)).toEqual({
      kind: "failed",
      step: "pair",
      error: { kind: "serverRejected" },
    });
    expect(world.calls).toEqual(["addGroup Living room"]);
  });

  it("undoes a pair only the master reports in time", async () => {
    const world = new FakePairWorld();
    world.partnerJoins = false;
    const startedAt = world.clock.now();

    const view = await pair(world);

    expect(view).toEqual({
      kind: "failed",
      step: "confirm",
      error: { kind: "notConfirmed", undone: true },
    });
    expect(world.calls.at(-1)).toBe("removeGroup Living room");
    expect(world.groups.get(LEFT.deviceID)).toBeNull();
    expect(world.clock.now() - startedAt).toBeLessThanOrEqual(
      PAIR_BUDGET_MS + 1000,
    );
  });

  it("doesn't call a pair undone when the other speaker didn't take the undo", async () => {
    const world = new FakePairWorld();
    world.partnerJoins = false;
    world.peerUnreachable = true;

    expect(await pair(world)).toEqual({
      kind: "failed",
      step: "confirm",
      error: { kind: "notConfirmed", undone: false },
    });
    expect(world.calls.at(-1)).toBe("removeGroup Living room");
    expect(world.groups.get(LEFT.deviceID)).toBeNull();
  });

  it("leaves alone a pair the partner reports that this attempt didn't make", async () => {
    const world = new FakePairWorld();
    world.partnerJoins = false;
    const other = reported(
      {
        name: "Office + Kitchen",
        masterDeviceId: RIGHT.deviceID,
        roles: [
          { deviceId: RIGHT.deviceID, role: "LEFT", ipAddress: RIGHT.host },
          { deviceId: "A0F6FD000001", role: "RIGHT", ipAddress: "192.0.2.3" },
        ],
      },
      "2222222",
    );
    world.groups.set(RIGHT.deviceID, other);

    expect(await pair(world)).toEqual({
      kind: "failed",
      step: "confirm",
      error: { kind: "notConfirmed", undone: true },
    });
    // Undone through the master, which reports this attempt's pair.
    expect(world.calls.at(-1)).toBe("removeGroup Living room");
    expect(world.calls).not.toContain("removeGroup Office");
    expect(world.groups.get(RIGHT.deviceID)).toBe(other);
  });

  it("needs both speakers to report the pair in the same check", async () => {
    const world = new FakePairWorld();
    world.partnerJoins = false;
    const session = createPairSession(world.deps(), TARGET);
    session.start();
    // The master reports the pair at the first check, then stops answering
    // just as the partner reports it.
    await world.clock.runUntil(() =>
      world.log.events.some((event) => event.name === "pair.confirm"),
    );
    world.unreachable.add(LEFT.deviceID);
    world.groups.set(RIGHT.deviceID, world.groups.get(LEFT.deviceID) ?? null);
    await world.clock.runUntil(() => session.getView().kind !== "working");

    expect(session.getView()).toEqual({
      kind: "failed",
      step: "confirm",
      error: { kind: "notConfirmed", undone: true },
    });
    expect(world.calls.at(-1)).toBe("removeGroup Office");
  });

  it("doesn't undo through a master that reports no pair by then", async () => {
    const world = new FakePairWorld();
    world.partnerJoins = false;
    const session = createPairSession(world.deps(), TARGET);
    session.start();
    await world.clock.runUntil(() =>
      world.log.events.some((event) => event.name === "pair.confirm"),
    );
    world.groups.set(LEFT.deviceID, null);
    await world.clock.runUntil(() => session.getView().kind !== "working");

    expect(session.getView()).toEqual({
      kind: "failed",
      step: "confirm",
      error: { kind: "notConfirmed", undone: false },
    });
    expect(
      world.calls.filter((call) => call.startsWith("removeGroup")),
    ).toEqual([]);
  });

  it("sends nothing to the speakers when our server is too old to store pairs", async () => {
    const world = new FakePairWorld();
    world.server = { kind: "tooOld", version: "0.0.5" };

    expect(await pair(world)).toMatchObject({
      kind: "failed",
      step: "check",
      error: { kind: "serverUnsupported" },
    });
    expect(world.calls).toEqual([]);
  });
});
