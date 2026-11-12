import { describe, expect, it } from "vite-plus/test";

import type { BoseSpeaker } from "../registry/types";
import { resolveSelectedSpeaker } from "./selected-speaker";

const speaker = (
  deviceID: string,
  overrides: Partial<BoseSpeaker> = {},
): BoseSpeaker => ({
  deviceID,
  status: "online",
  host: "192.168.1.30",
  port: 8090,
  name: deviceID,
  speakerName: deviceID,
  type: "SoundTouch 10",
  radio: { kind: "checking" },
  playStatus: "STOP_STATE",
  ...overrides,
});

const playing = { playStatus: "PLAY_STATE", track: "FIP Jazz" };

describe("resolveSelectedSpeaker", () => {
  it("keeps the picked speaker while another one starts playing", () => {
    const listed = [speaker("Bedroom", playing), speaker("Kitchen")];

    expect(resolveSelectedSpeaker(listed, "Kitchen")?.deviceID).toBe("Kitchen");
  });

  it("keeps the picked speaker while it's offline, rather than moving to another", () => {
    const listed = [
      speaker("Bedroom", playing),
      speaker("Kitchen", { status: "offline", playStatus: undefined }),
    ];

    expect(resolveSelectedSpeaker(listed, "Kitchen")).toMatchObject({
      deviceID: "Kitchen",
      status: "offline",
    });
  });

  it("falls back to the speaker playing once the picked one is forgotten", () => {
    const listed = [speaker("Bedroom"), speaker("Office", playing)];

    expect(resolveSelectedSpeaker(listed, "Kitchen")?.deviceID).toBe("Office");
  });

  it("before any pick, prefers a playing speaker, then a paused one with something loaded", () => {
    const paused = speaker("Bedroom", {
      playStatus: "PAUSE_STATE",
      track: "FIP Jazz",
    });

    expect(
      resolveSelectedSpeaker(
        [paused, speaker("Kitchen"), speaker("Office", playing)],
        null,
      )?.deviceID,
    ).toBe("Office");
    expect(
      resolveSelectedSpeaker([speaker("Attic"), paused], null)?.deviceID,
    ).toBe("Bedroom");
  });

  it("before any pick with nothing playing, takes the first reached speaker, not an offline one", () => {
    const listed = [
      speaker("Attic", { status: "offline" }),
      speaker("Bedroom"),
      speaker("Kitchen"),
    ];

    expect(resolveSelectedSpeaker(listed, null)?.deviceID).toBe("Bedroom");
    expect(
      resolveSelectedSpeaker([speaker("Attic", { status: "offline" })], null),
    ).toBeUndefined();
  });

  it("takes a pair's partner, which isn't listed, for its pair's master", () => {
    const pair = {
      id: "3271058",
      name: "Living room + Office",
      masterDeviceID: "Living room",
      roles: [
        { deviceID: "Living room", role: "LEFT" as const },
        { deviceID: "Office", role: "RIGHT" as const },
      ],
    };
    const listed = [
      speaker("Bedroom", playing),
      speaker("Living room", { pair, status: "offline" }),
    ];

    expect(resolveSelectedSpeaker(listed, "Office")?.deviceID).toBe(
      "Living room",
    );
  });
});
