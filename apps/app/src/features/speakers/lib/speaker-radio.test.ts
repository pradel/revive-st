import { describe, expect, it } from "vite-plus/test";

import type { SpeakerServer } from "./server-profiles";
import { speakerRadio, stationSources } from "./speaker-radio";

const OUR_SERVER = "https://api.revivest.app";
const ACCOUNT = "6f1c2a3b-4d5e-4f60-8a1b-2c3d4e5f6a7b";

const server = (kind: SpeakerServer["kind"]): SpeakerServer => ({
  kind,
  name: kind,
  setup: "warn",
});

const BOTH = { radioBrowser: true, customStations: true };
const NONE = { radioBrowser: false, customStations: false };

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

describe("speakerRadio", () => {
  const radio = (overrides: Partial<Parameters<typeof speakerRadio>[0]>) =>
    speakerRadio({
      server: server("unknown"),
      margeURL: "https://radio.example",
      accountId: ACCOUNT,
      sources: BOTH,
      ourServer: OUR_SERVER,
      ...overrides,
    });

  it("is ready through a server we don't know that offers a station source", () => {
    expect(
      radio({ sources: { radioBrowser: false, customStations: true } }).ready,
    ).toBe(true);
  });

  it("is never ready on Bose's servers, whatever the speaker reports", () => {
    expect(radio({ server: server("bose") }).ready).toBe(false);
  });

  it.each([
    ["without an account", { accountId: "" }],
    ["without a station source ready", { sources: NONE }],
  ])("isn't ready %s", (_label, overrides) => {
    expect(radio(overrides).ready).toBe(false);
  });

  it("is on our server only when paired on our server", () => {
    expect(
      radio({ server: server("revive"), margeURL: OUR_SERVER }).onOurServer,
    ).toBe(true);
    expect(
      radio({ server: server("revive"), margeURL: OUR_SERVER, accountId: "" })
        .onOurServer,
    ).toBe(false);
    expect(radio({}).onOurServer).toBe(false);
  });
});
