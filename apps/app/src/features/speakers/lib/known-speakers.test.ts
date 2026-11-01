import { describe, expect, it } from "vite-plus/test";

import { parseKnownSpeakers } from "./known-speakers";

const OFFICE = {
  deviceID: "EC1127C25A50",
  name: "Office",
  type: "SoundTouch 10",
  host: "192.168.1.189",
  port: 8090,
};

describe("parseKnownSpeakers", () => {
  it("reads a stored list", () => {
    expect(parseKnownSpeakers(JSON.stringify([OFFICE]))).toEqual([OFFICE]);
  });

  it("drops entries the app can't connect to, keeping the rest", () => {
    const stored = JSON.stringify([
      OFFICE,
      { ...OFFICE, deviceID: "" },
      { ...OFFICE, host: undefined },
      { ...OFFICE, port: "8090" },
      null,
    ]);
    expect(parseKnownSpeakers(stored)).toEqual([OFFICE]);
  });

  it("keeps the speaker's last radio, and drops one it can't read", () => {
    const radio = {
      server: { kind: "soundcork", name: "soundcork", setup: "warn" },
      margeURL: "http://192.168.1.10:8000/marge",
      onOurServer: false,
      sources: { radioBrowser: true, customStations: false },
      ready: true,
    };
    expect(
      parseKnownSpeakers(
        JSON.stringify([
          { ...OFFICE, radio },
          {
            ...OFFICE,
            deviceID: "B",
            radio: { ...radio, server: { kind: "gone" } },
          },
        ]),
      ),
    ).toEqual([
      { ...OFFICE, radio },
      { ...OFFICE, deviceID: "B" },
    ]);
  });

  it("starts empty when nothing or something unreadable is stored", () => {
    expect(parseKnownSpeakers(null)).toEqual([]);
    expect(parseKnownSpeakers("{not json")).toEqual([]);
    expect(parseKnownSpeakers(JSON.stringify({ speakers: [OFFICE] }))).toEqual(
      [],
    );
  });
});
