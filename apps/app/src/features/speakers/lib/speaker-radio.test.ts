import { describe, expect, it } from "vite-plus/test";

import type { SpeakerServer } from "./server-profiles";
import {
  radioStatus,
  stationSources,
  type SpeakerRadio,
} from "./speaker-radio";

const OUR_SERVER = "https://api.revivest.app";
const ANOTHER_REVIVE = "http://192.168.1.50:3000";

const SERVERS = {
  revive: { kind: "revive", name: "Revive ST", setup: "setUp" },
  soundcork: { kind: "soundcork", name: "soundcork", setup: "warn" },
  streborn: { kind: "streborn", name: "STR", setup: "blocked" },
  bose: { kind: "bose", name: "Bose", setup: "setUp" },
  unknown: { kind: "unknown", name: "radio.example", setup: "warn" },
} satisfies Record<string, SpeakerServer>;

const BOTH = { radioBrowser: true, customStations: true };
const NONE = { radioBrowser: false, customStations: false };

/** A paired speaker on our server with both station sources, unless overridden. */
const read = (overrides: Partial<SpeakerRadio> = {}): SpeakerRadio => ({
  server: SERVERS.revive,
  margeURL: OUR_SERVER,
  paired: true,
  sources: BOTH,
  ...overrides,
});

const status = (radio: SpeakerRadio, ourServer = OUR_SERVER) =>
  radioStatus(radio, false, ourServer);

describe("stationSources", () => {
  it("offers only the station sources the speaker reports ready", () => {
    expect(
      stationSources([
        { source: "RADIO_BROWSER", status: "UNAVAILABLE" },
        { source: "LOCAL_INTERNET_RADIO", status: "READY" },
        { source: "TUNEIN", status: "READY" },
      ]),
    ).toEqual({ radioBrowser: false, customStations: true });
  });
});

describe("radioStatus", () => {
  it("is checking until a check first answers, and unreachable when one didn't", () => {
    expect(radioStatus(undefined, false, OUR_SERVER)).toEqual({
      kind: "checking",
    });
    expect(radioStatus(undefined, true, OUR_SERVER)).toEqual({
      kind: "unreachable",
    });
  });

  it("keeps the last result when a later check isn't answered", () => {
    expect(radioStatus(read(), true, OUR_SERVER)).toMatchObject({
      kind: "ready",
    });
  });

  it("is ready through a server we don't know that offers a station source", () => {
    expect(
      status(
        read({
          server: SERVERS.unknown,
          margeURL: "https://radio.example",
          sources: { radioBrowser: false, customStations: true },
        }),
      ).kind,
    ).toBe("ready");
  });

  it.each([
    [
      "on Bose's servers, whatever the speaker reports",
      { server: SERVERS.bose },
    ],
    ["without an account", { paired: false }],
    ["without a station source ready", { sources: NONE }],
  ])("needs setup %s", (_label, overrides) => {
    expect(status(read(overrides)).kind).toBe("needsSetup");
  });

  it("plays through our server, set up again without a warning", () => {
    expect(status(read())).toMatchObject({
      through: null,
      setup: { kind: "again" },
    });
    expect(status(read({ paired: false }))).toMatchObject({
      through: null,
      setup: { kind: "setUp" },
    });
  });

  it("names another Revive ST server by its address, and warns before leaving it", () => {
    expect(status(read({ margeURL: ANOTHER_REVIVE }))).toMatchObject({
      kind: "ready",
      serverName: "Revive ST",
      through: "192.168.1.50:3000",
      setup: { kind: "leaving", server: "192.168.1.50:3000" },
    });
  });

  it("judges a speaker against our server as it is now", () => {
    expect(status(read(), ANOTHER_REVIVE)).toMatchObject({
      through: "api.revivest.app",
      setup: { kind: "leaving", server: "api.revivest.app" },
    });
    expect(
      status(read({ margeURL: ANOTHER_REVIVE }), ANOTHER_REVIVE),
    ).toMatchObject({ through: null, setup: { kind: "again" } });
  });

  it("follows the server's setup policy elsewhere", () => {
    const at = (server: SpeakerServer) =>
      status(read({ server, margeURL: "http://192.168.1.10:8000/marge" }));
    expect(at(SERVERS.soundcork)).toMatchObject({
      setup: { kind: "leaving", server: "soundcork" },
    });
    expect(at(SERVERS.streborn)).toMatchObject({
      setup: { kind: "blocked", server: "STR" },
    });
    expect(at(SERVERS.bose)).toMatchObject({ setup: { kind: "setUp" } });
  });
});
