import { describe, expect, it } from "vite-plus/test";

import {
  type CastStation,
  confirmStationPlaying,
  customStationLocation,
  radioBrowserLocation,
  stationFit,
  StationNotStartedError,
} from "./radio";
import { radioStatus, type StationSources } from "./speaker-radio";

const LOCATION = radioBrowserLocation("9610c454-0601-11e8-ae97-52543be04c81");
const PREVIOUS = radioBrowserLocation("2470f399-4883-44fb-8eb4-f54a6df61e72");
const NO_DELAYS = [0, 0, 0, 0];

describe("customStationLocation", () => {
  it("carries the station as UTF-8 base64 JSON the server can decode", () => {
    const location = customStationLocation({
      streamUrl: "http://stream.example:8000/live?x=1&y=2",
      name: "Radio Ñandú 東京",
      favicon: "https://cdn.example/logo.png",
    });
    const data = new URLSearchParams(location.split("?")[1]).get("data") ?? "";
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(data), (char) => char.charCodeAt(0)),
    );
    expect(location.startsWith("/station?data=")).toBe(true);
    expect(JSON.parse(json)).toEqual({
      name: "Radio Ñandú 東京",
      imageUrl: "https://cdn.example/logo.png",
      streamUrl: "http://stream.example:8000/live?x=1&y=2",
    });
  });
});

describe("stationFit", () => {
  const OUR_SERVER = "https://api.revivest.app";
  const SOUNDCORK = "http://192.168.1.10:8000/marge";
  const radioBrowser: CastStation = {
    kind: "radioBrowser",
    stationuuid: "9610c454-0601-11e8-ae97-52543be04c81",
    streamUrl: "http://stream.example/live.mp3",
    name: "Dance Wave!",
    favicon: "",
  };
  const custom: CastStation = {
    kind: "custom",
    streamUrl: "http://stream.example/live.mp3",
    name: "My stream",
    favicon: "",
  };

  /** A paired speaker on `margeURL` (ours by default), as last checked. */
  const radio = (
    sources: StationSources,
    margeURL = OUR_SERVER,
    paired = true,
  ) =>
    radioStatus(
      {
        server:
          margeURL === OUR_SERVER
            ? { kind: "revive", name: "Revive ST", setup: "setUp" }
            : { kind: "soundcork", name: "soundcork", setup: "warn" },
        margeURL,
        paired,
        sources,
      },
      false,
      OUR_SERVER,
    );

  it("plays a Radio Browser station by its id where Radio Browser is offered", () => {
    expect(
      stationFit(
        radio({ radioBrowser: true, customStations: true }),
        radioBrowser,
      ),
    ).toMatchObject({
      kind: "plays",
      contentItem: { source: "RADIO_BROWSER", location: LOCATION },
      through: null,
    });
  });

  it("plays a Radio Browser station from its stream where only custom stations are offered", () => {
    expect(
      stationFit(
        radio({ radioBrowser: false, customStations: true }, SOUNDCORK),
        radioBrowser,
      ),
    ).toMatchObject({
      kind: "plays",
      contentItem: {
        source: "LOCAL_INTERNET_RADIO",
        location: customStationLocation(radioBrowser),
      },
      through: "soundcork",
    });
  });

  it("offers setup to add custom stations on our server only", () => {
    const sources = { radioBrowser: true, customStations: false };
    expect(stationFit(radio(sources), custom)).toEqual({
      kind: "noSource",
      server: "Revive ST",
      setupAdds: true,
    });
    expect(stationFit(radio(sources, SOUNDCORK), custom)).toEqual({
      kind: "noSource",
      server: "soundcork",
      setupAdds: false,
    });
    // Another Revive ST server: setting the speaker up would move it to ours.
    const otherRevive = radioStatus(
      {
        server: { kind: "revive", name: "Revive ST", setup: "setUp" },
        margeURL: "http://192.168.1.50:3000",
        paired: true,
        sources,
      },
      false,
      OUR_SERVER,
    );
    expect(stationFit(otherRevive, custom)).toEqual({
      kind: "noSource",
      server: "192.168.1.50:3000",
      setupAdds: false,
    });
  });

  it("can't add a source that plays a Radio Browser station whose stream isn't known", () => {
    expect(
      stationFit(radio({ radioBrowser: false, customStations: true }), {
        ...radioBrowser,
        streamUrl: "",
      }),
    ).toMatchObject({ kind: "noSource", setupAdds: false });
  });

  it("plays nothing on a speaker that needs setup", () => {
    expect(
      stationFit(
        radio({ radioBrowser: true, customStations: true }, OUR_SERVER, false),
        radioBrowser,
      ),
    ).toEqual({ kind: "notReady" });
  });
});

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

  it("ignores the previous station's failure until the speaker switches", async () => {
    const { read } = speaker(
      nowPlaying("INVALID_PLAY_STATE", PREVIOUS),
      nowPlaying("PLAY_STATE"),
    );
    await confirmStationPlaying(read, LOCATION, NO_DELAYS);
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
