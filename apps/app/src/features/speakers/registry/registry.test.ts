import type { Preset, Speaker, SpeakerState } from "bose-api-speaker-client";
import { describe, expect, it } from "vite-plus/test";

import type { KnownSpeaker } from "../lib/known-speakers";
import type { SpeakerRegistryDeps } from "./ports";
import { createSpeakerRegistry } from "./registry";

const OUR_SERVER = "https://api.revivest.app";
const ACCOUNT = "6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b";

const PRESETS: Preset[] = [
  {
    id: 1,
    contentItem: {
      source: "RADIO_BROWSER",
      type: "stationurl",
      location: "/stations/byuuid/9610c454-0601-11e8-ae97-52543be04c81",
      sourceAccount: "",
      isPresetable: true,
      itemName: "Dance Wave!",
      containerArt: "",
    },
  },
];

/** A speaker on the fake network, answering at its address. */
interface FakeSpeaker {
  deviceID: string;
  name: string;
  answers: boolean;
  margeURL: string;
  account: string;
  presets?: Preset[];
  /** Pushes a state, as the speaker's live connection does. */
  push?: (state: SpeakerState) => void;
}

const KITCHEN: KnownSpeaker = {
  deviceID: "A0F6FD000001",
  name: "Kitchen",
  type: "SoundTouch 10",
  host: "192.168.1.30",
  port: 8090,
};

const onNetwork = (overrides: Partial<FakeSpeaker> = {}): FakeSpeaker => ({
  deviceID: KITCHEN.deviceID,
  name: "Kitchen",
  answers: true,
  margeURL: "https://other.example",
  account: "1234567",
  ...overrides,
});

const stateOf = (speaker: FakeSpeaker): SpeakerState => ({
  volume: 20,
  isMuted: false,
  connectionState: "connected",
  powerState: "on",
  name: speaker.name,
  type: "SoundTouch 10",
  presets: speaker.presets,
  margeURL: speaker.margeURL,
  margeAccountUUID: speaker.account,
});

function world({ stored = [] }: { stored?: KnownSpeaker[] } = {}) {
  const network = new Map<string, FakeSpeaker>();
  const saved: KnownSpeaker[][] = [];
  const synced: { accountId: string; deviceID: string }[] = [];
  let found: ((host: string, port: number) => void) | undefined;

  const deps: SpeakerRegistryDeps = {
    speaker: {
      info: async (host) => {
        const speaker = network.get(host);
        return Promise.resolve(
          speaker?.answers
            ? {
                deviceID: speaker.deviceID,
                name: speaker.name,
                type: "SoundTouch 10",
              }
            : undefined,
        );
      },
      link: (host, port, deviceID, onState) => {
        const speaker = network.get(host);
        if (speaker) {
          speaker.push = onState;
        }
        return {
          host,
          port,
          client: {} as Speaker,
          open: async () => Promise.resolve(stateOf(speaker!)),
          isConnected: () => true,
          refresh: async () => Promise.resolve(),
          reconnect: () => undefined,
          close: () => undefined,
        };
      },
    },
    scanner: {
      start: (onFound) => {
        found = onFound;
        return () => {
          found = undefined;
        };
      },
    },
    storage: {
      load: async () => Promise.resolve(stored),
      save: async (list) => {
        saved.push([...list]);
        return Promise.resolve();
      },
    },
    ourServer: {
      url: () => OUR_SERVER,
      syncPresets: async (accountId, deviceID) => {
        synced.push({ accountId, deviceID });
        return Promise.resolve();
      },
    },
    later: () => () => undefined,
    log: { warn: () => undefined },
  };

  const registry = createSpeakerRegistry(deps);
  return {
    registry,
    network,
    saved,
    synced,
    /** The speakers as the screens see them. */
    listed: () => registry.getSnapshot().listed,
    scanning: () => registry.getSnapshot().scan,
    /** The scan finds a speaker at `host`. */
    find: (host: string) => {
      found?.(host, 8090);
    },
    /** Lets every pending request answer: the fakes all answer at once. */
    settle: async () => {
      for (let round = 0; round < 50; round += 1) {
        await Promise.resolve();
      }
    },
  };
}

describe("speaker registry", () => {
  it("lists remembered speakers at once, before reaching any", async () => {
    const { registry, listed } = world({ stored: [KITCHEN] });
    await registry.restore();

    expect(registry.getSnapshot().restored).toBe(true);
    expect(listed()).toMatchObject([
      { deviceID: KITCHEN.deviceID, name: "Kitchen", status: "connecting" },
    ]);
  });

  it("shows a reached speaker online with its live state, and remembers its new name", async () => {
    const { registry, network, listed, saved, settle } = world({
      stored: [KITCHEN],
    });
    network.set(KITCHEN.host, onNetwork({ name: "Kitchen 2" }));
    await registry.restore();

    registry.reconnectAll();
    await settle();

    expect(listed()).toMatchObject([
      { status: "online", name: "Kitchen 2", volume: 20 },
    ]);
    expect(saved.at(-1)).toEqual([{ ...KITCHEN, name: "Kitchen 2" }]);
  });

  it("shows a remembered speaker that doesn't answer offline", async () => {
    const { registry, listed, settle } = world({ stored: [KITCHEN] });
    await registry.restore();

    registry.reconnectAll();
    await settle();

    expect(listed()).toMatchObject([{ status: "offline" }]);
  });

  it("doesn't take another device at a remembered speaker's address for it", async () => {
    const { registry, network, listed, settle } = world({ stored: [KITCHEN] });
    network.set(KITCHEN.host, onNetwork({ deviceID: "B0F6FD000002" }));
    await registry.restore();

    registry.reconnectAll();
    await settle();

    expect(listed()).toMatchObject([
      { deviceID: KITCHEN.deviceID, status: "offline" },
    ]);
  });

  it("lists a speaker the scan finds at its new address", async () => {
    const { registry, network, listed, saved, find, settle } = world({
      stored: [KITCHEN],
    });
    network.set("192.168.1.31", onNetwork());
    await registry.restore();

    registry.rescan();
    find("192.168.1.31");
    await settle();

    expect(listed()).toMatchObject([
      { deviceID: KITCHEN.deviceID, host: "192.168.1.31", status: "online" },
    ]);
    expect(saved.at(-1)).toEqual([{ ...KITCHEN, host: "192.168.1.31" }]);
  });

  it("keeps a speaker forgotten while it was being reached", async () => {
    const { registry, network, listed, saved, settle } = world({
      stored: [KITCHEN],
    });
    network.set(KITCHEN.host, onNetwork());
    await registry.restore();

    registry.reconnectAll();
    registry.forget(KITCHEN.deviceID);
    await settle();

    expect(listed()).toEqual([]);
    expect(saved.at(-1)).toEqual([]);
  });

  it("syncs presets to our server only for speakers paired on it", async () => {
    const { registry, network, synced, find, settle } = world();
    network.set(
      "192.168.1.31",
      onNetwork({ margeURL: OUR_SERVER, account: ACCOUNT, presets: PRESETS }),
    );
    network.set(
      "192.168.1.32",
      onNetwork({ deviceID: "B0F6FD000002", presets: PRESETS }),
    );
    network.set(
      "192.168.1.33",
      onNetwork({
        deviceID: "C0F6FD000003",
        margeURL: OUR_SERVER,
        account: "",
        presets: PRESETS,
      }),
    );
    await registry.restore();

    registry.rescan();
    find("192.168.1.31");
    find("192.168.1.32");
    find("192.168.1.33");
    await settle();

    expect(synced).toEqual([
      { accountId: ACCOUNT, deviceID: KITCHEN.deviceID },
    ]);
  });

  it("shows the state a reached speaker pushes", async () => {
    const speaker = onNetwork();
    const { registry, network, listed, settle } = world({ stored: [KITCHEN] });
    network.set(KITCHEN.host, speaker);
    await registry.restore();
    registry.reconnectAll();
    await settle();

    speaker.push?.({ ...stateOf(speaker), volume: 45 });

    expect(listed()).toMatchObject([{ volume: 45 }]);
  });

  it("ends an automatic scan once every listed speaker answered, not one the user asked for", async () => {
    const { registry, network, scanning, settle } = world({
      stored: [KITCHEN],
    });
    network.set(KITCHEN.host, onNetwork());
    await registry.restore();

    registry.reconnectAll();
    await settle();
    expect(scanning()).toBeNull();

    registry.rescan();
    await settle();
    expect(scanning()).toBe("user");
  });
});
