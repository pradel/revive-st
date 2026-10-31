import { describe, expect, it } from "vite-plus/test";

import {
  confirmStationPlaying,
  radioBrowserLocation,
  StationNotStartedError,
} from "./radio";

const LOCATION = radioBrowserLocation("9610c454-0601-11e8-ae97-52543be04c81");
const PREVIOUS = radioBrowserLocation("2470f399-4883-44fb-8eb4-f54a6df61e72");
const NO_DELAYS = [0, 0, 0, 0];

const nowPlaying = (
  playStatus: string,
  location = LOCATION,
  source = "RADIO_BROWSER",
) => ({
  source,
  playStatus: playStatus as never,
  contentItem: {
    source,
    type: "stationurl",
    location,
    sourceAccount: "",
    isPresetable: true,
    itemName: "Dance Wave!",
    containerArt: "",
  },
});

/** A speaker answering each readback with the next state, then the last. */
const speaker = (...states: (ReturnType<typeof nowPlaying> | null)[]) => {
  let reads = 0;
  const read = async () =>
    Promise.resolve(states[Math.min(reads++, states.length - 1)]);
  return { read, reads: () => reads };
};

describe("confirmStationPlaying", () => {
  it("resolves once the speaker plays the station", async () => {
    const { read, reads } = speaker(
      nowPlaying("BUFFERING_STATE"),
      nowPlaying("PLAY_STATE"),
    );
    await confirmStationPlaying(read, LOCATION, NO_DELAYS);
    expect(reads()).toBe(2);
  });

  it("waits while the speaker still plays the previous station", async () => {
    const { read } = speaker(nowPlaying("PLAY_STATE", PREVIOUS));
    await expect(
      confirmStationPlaying(read, LOCATION, NO_DELAYS),
    ).rejects.toBeInstanceOf(StationNotStartedError);
  });

  it("fails as soon as the speaker reports an error", async () => {
    const { read, reads } = speaker(
      nowPlaying("BUFFERING_STATE"),
      nowPlaying("INVALID_PLAY_STATE"),
      nowPlaying("PLAY_STATE"),
    );
    await expect(
      confirmStationPlaying(read, LOCATION, NO_DELAYS),
    ).rejects.toBeInstanceOf(StationNotStartedError);
    expect(reads()).toBe(2);
  });

  it("fails when the speaker falls back to an error source", async () => {
    const { read } = speaker(nowPlaying("STOP_STATE", "", "INVALID_SOURCE"));
    await expect(
      confirmStationPlaying(read, LOCATION, NO_DELAYS),
    ).rejects.toBeInstanceOf(StationNotStartedError);
  });

  it("counts a station still buffering at the last readback as started", async () => {
    const { read } = speaker(nowPlaying("BUFFERING_STATE"));
    await confirmStationPlaying(read, LOCATION, NO_DELAYS);
  });

  it("fails when the station stopped by the last readback", async () => {
    const { read } = speaker(
      nowPlaying("BUFFERING_STATE"),
      nowPlaying("STOP_STATE"),
    );
    await expect(
      confirmStationPlaying(read, LOCATION, NO_DELAYS),
    ).rejects.toBeInstanceOf(StationNotStartedError);
  });

  it("keeps reading when the speaker doesn't answer", async () => {
    const { read } = speaker(null, null, nowPlaying("PLAY_STATE"));
    await confirmStationPlaying(read, LOCATION, NO_DELAYS);
  });
});
