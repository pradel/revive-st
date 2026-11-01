import type { Preset, Speaker, SpeakerState } from "bose-api-speaker-client";
import { describe, expect, it } from "vite-plus/test";

import type { KnownSpeaker } from "../lib/known-speakers";
import type { SpeakerRadio } from "../lib/speaker-radio";
import type { SpeakerLinkEvents, SpeakerRegistryDeps } from "./ports";
import { createSpeakerRegistry } from "./registry";

const OUR_SERVER = "https://api.revivest.app";
const ACCOUNT = "6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b";

const radioVia = (
  name: string,
  overrides: Partial<SpeakerRadio> = {},
): SpeakerRadio => ({
  server: { kind: "soundcork", name, setup: "warn" },
  margeURL: "http://192.168.1.10:8000/marge",
  paired: true,
  sources: { radioBrowser: true, customStations: true },
  ...overrides,
});

/** How the screens see a `radioVia(name)`. */
const shownVia = (name: string) => ({
  kind: "ready",
  serverName: name,
  through: name,
});

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

/** A speaker on the fake network, answering at `host`. */
interface FakeSpeaker {
  deviceID: string;
  name: string;
  answers: boolean;
  margeURL: string;
  account: string;
  /** What the radio check returns; it fails without one. */
  radio?: SpeakerRadio;
  presets?: Preset[];
  events?: SpeakerLinkEvents;
}

const KITCHEN: KnownSpeaker = {
  deviceID: "A0F6FD000001",
  name: "Kitchen",
  type: "SoundTouch 10",
  host: "192.168.1.30",
  port: 8090,
  radio: radioVia("soundcork"),
};

function world({ stored = [] }: { stored?: KnownSpeaker[] } = {}) {
  const network = new Map<string, FakeSpeaker>();
  const saved: KnownSpeaker[][] = [];
  const synced: { accountId: string; deviceID: string }[] = [];
  let found: ((host: string, port: number) => void) | undefined;
  let ourServer = OUR_SERVER;

  const state = (speaker: FakeSpeaker): SpeakerState => ({
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

  /** While set, radio checks wait here until a test lets them answer. */
  let heldChecks: (() => void)[] | undefined;

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
                margeURL: speaker.margeURL,
                margeAccountUUID: speaker.account,
              }
            : undefined,
        );
      },
      radio: async ({ host }) => {
        const radio = network.get(host)?.radio;
        const held = heldChecks;
        if (held) {
          await new Promise<void>((resolve) => {
            held.push(resolve);
          });
        }
        if (!radio) {
          throw new Error("no answer");
        }
        return radio;
      },
      link: (host, port, deviceID, events) => {
        const speaker = network.get(host);
        if (speaker) {
          speaker.events = events;
        }
        return {
          host,
          port,
          client: {} as Speaker,
          open: async () => Promise.resolve(state(speaker!)),
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
      url: () => ourServer,
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
    /** The user picks another server in Settings. */
    setOurServer: (url: string) => {
      ourServer = url;
    },
    /** Radio checks from now on wait until `answerHeldChecks`. */
    holdChecks: () => {
      heldChecks = [];
    },
    /**
     * Lets the held radio checks answer, newest first so a stale one lands
     * last, and stops holding new ones.
     */
    answerHeldChecks: () => {
      const held = heldChecks ?? [];
      heldChecks = undefined;
      for (const resolve of held.toReversed()) {
        resolve();
      }
    },
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

const onNetwork = (overrides: Partial<FakeSpeaker> = {}): FakeSpeaker => ({
  deviceID: KITCHEN.deviceID,
  name: "Kitchen",
  answers: true,
  margeURL: "http://192.168.1.10:8000/marge",
  account: "1234567",
  radio: radioVia("soundcork"),
  ...overrides,
});

describe("speaker registry", () => {
  it("lists remembered speakers at once, with their last radio, before reaching any", async () => {
    const { registry, listed } = world({ stored: [KITCHEN] });
    await registry.restore();

    expect(registry.getSnapshot().restored).toBe(true);
    expect(listed()).toMatchObject([
      {
        deviceID: KITCHEN.deviceID,
        status: "connecting",
        radio: shownVia("soundcork"),
      },
    ]);
  });

  it("shows a reached speaker online with its radio checked again, and remembers it", async () => {
    const { registry, network, listed, saved, settle } = world({
      stored: [KITCHEN],
    });
    const fresh = radioVia("AfterTouch");
    network.set(KITCHEN.host, onNetwork({ radio: fresh }));
    await registry.restore();

    registry.reconnectAll();
    await settle();

    expect(listed()).toMatchObject([
      { status: "online", volume: 20, radio: shownVia("AfterTouch") },
    ]);
    expect(saved.at(-1)).toEqual([{ ...KITCHEN, radio: fresh }]);
  });

  it("shows a remembered speaker that doesn't answer offline, keeping its last radio", async () => {
    const { registry, listed, settle } = world({ stored: [KITCHEN] });
    await registry.restore();

    registry.reconnectAll();
    await settle();

    expect(listed()).toMatchObject([
      { status: "offline", radio: shownVia("soundcork") },
    ]);
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

  it("lists a speaker the scan finds, with its radio", async () => {
    const { registry, network, listed, find, settle } = world();
    network.set("192.168.1.31", onNetwork());
    await registry.restore();

    registry.rescan();
    find("192.168.1.31");
    await settle();

    expect(listed()).toMatchObject([
      {
        deviceID: KITCHEN.deviceID,
        host: "192.168.1.31",
        status: "online",
        radio: shownVia("soundcork"),
      },
    ]);
  });

  it("keeps the last radio when a check isn't answered", async () => {
    const { registry, network, listed, settle } = world({ stored: [KITCHEN] });
    network.set(KITCHEN.host, onNetwork({ radio: undefined }));
    await registry.restore();

    registry.reconnectAll();
    await settle();

    expect(listed()).toMatchObject([
      { status: "online", radio: shownVia("soundcork") },
    ]);
  });

  it("checks the radio again when the speaker says its settings changed", async () => {
    const { registry, network, listed, settle } = world({ stored: [KITCHEN] });
    const speaker = onNetwork();
    network.set(KITCHEN.host, speaker);
    await registry.restore();
    registry.reconnectAll();
    await settle();

    const moved = radioVia("STR", {
      server: { kind: "streborn", name: "STR", setup: "blocked" },
    });
    speaker.radio = moved;
    speaker.events?.onSettingsChange();
    await settle();

    expect(listed()[0]?.radio).toMatchObject({
      kind: "ready",
      serverName: "STR",
      setup: { kind: "blocked", server: "STR" },
    });
  });

  it("keeps a remembered speaker's name when its state comes without one", async () => {
    const speaker = onNetwork();
    const { registry, network, listed, saved, settle } = world({
      stored: [KITCHEN],
    });
    network.set(KITCHEN.host, speaker);
    await registry.restore();
    registry.reconnectAll();
    await settle();

    speaker.events?.onState({
      volume: 20,
      isMuted: false,
      connectionState: "connected",
      powerState: "on",
    });

    expect(listed()).toMatchObject([{ name: "Kitchen", status: "online" }]);
    expect(saved).toEqual([]);
  });

  it("keeps a speaker forgotten while it was being reached", async () => {
    const { registry, network, listed, settle } = world({ stored: [KITCHEN] });
    network.set(KITCHEN.host, onNetwork());
    await registry.restore();

    registry.reconnectAll();
    registry.forget(KITCHEN.deviceID);
    await settle();

    expect(listed()).toEqual([]);
  });

  it("syncs presets to our server only for speakers on it, and only when they change", async () => {
    const ours = onNetwork({
      margeURL: OUR_SERVER,
      account: ACCOUNT,
      presets: PRESETS,
    });
    const other = onNetwork({
      deviceID: "B0F6FD000002",
      presets: PRESETS,
    });
    const { registry, network, synced, find, settle } = world();
    network.set("192.168.1.31", ours);
    network.set("192.168.1.32", other);
    await registry.restore();
    registry.rescan();
    find("192.168.1.31");
    find("192.168.1.32");
    await settle();

    ours.events?.onState({
      volume: 30,
      isMuted: false,
      connectionState: "connected",
      powerState: "on",
      presets: PRESETS,
      margeURL: OUR_SERVER,
      margeAccountUUID: ACCOUNT,
    });
    await settle();

    expect(synced).toEqual([
      { accountId: ACCOUNT, deviceID: KITCHEN.deviceID },
    ]);
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

  it("checks the radio after a setup at the speaker's new address, ignoring another device", async () => {
    const { registry, network, listed, settle } = world({ stored: [KITCHEN] });
    network.set(KITCHEN.host, onNetwork());
    await registry.restore();
    registry.reconnectAll();
    await settle();

    // Another device took the old address; the speaker came back elsewhere.
    network.set(
      KITCHEN.host,
      onNetwork({ deviceID: "B0F6FD000002", radio: radioVia("other") }),
    );
    network.set("192.168.1.31", onNetwork({ radio: radioVia("AfterTouch") }));
    await registry.refreshRadio(KITCHEN.deviceID);
    expect(listed()[0]?.radio).toMatchObject(shownVia("soundcork"));

    await registry.refreshRadio(KITCHEN.deviceID, "192.168.1.31");
    expect(listed()).toMatchObject([
      { host: "192.168.1.31", radio: shownVia("AfterTouch") },
    ]);
  });

  it("shows the radio unreachable when a speaker never answered a check", async () => {
    const { radio: _radio, ...unchecked } = KITCHEN;
    const { registry, listed } = world({ stored: [unchecked] });
    await registry.restore();
    expect(listed()).toMatchObject([{ radio: { kind: "checking" } }]);

    await registry.refreshRadio(KITCHEN.deviceID);

    expect(listed()).toMatchObject([{ radio: { kind: "unreachable" } }]);
  });

  it("judges every listed speaker's radio against our server when it changes, offline ones too", async () => {
    const onOurs: KnownSpeaker = {
      ...KITCHEN,
      radio: radioVia("Revive ST", {
        server: { kind: "revive", name: "Revive ST", setup: "setUp" },
        margeURL: OUR_SERVER,
      }),
    };
    const { registry, listed, setOurServer, settle } = world({
      stored: [onOurs],
    });
    await registry.restore();
    registry.reconnectAll();
    await settle();
    expect(listed()).toMatchObject([
      { status: "offline", radio: { kind: "ready", through: null } },
    ]);

    setOurServer("http://192.168.1.20:3000");
    registry.refreshAllRadio();

    expect(listed()).toMatchObject([
      {
        status: "offline",
        radio: {
          through: "api.revivest.app",
          setup: { kind: "leaving", server: "api.revivest.app" },
        },
      },
    ]);
  });

  it("doesn't let a radio check started before a speaker was forgotten update it once found again", async () => {
    const speaker = onNetwork();
    const {
      registry,
      network,
      listed,
      find,
      holdChecks,
      answerHeldChecks,
      settle,
    } = world();
    network.set("192.168.1.31", speaker);
    await registry.restore();
    holdChecks();
    registry.rescan();
    find("192.168.1.31");
    await settle();

    registry.forget(KITCHEN.deviceID);
    speaker.radio = radioVia("AfterTouch");
    find("192.168.1.31");
    await settle();
    answerHeldChecks();
    await settle();

    expect(listed()[0]?.radio).toMatchObject(shownVia("AfterTouch"));
  });
});
