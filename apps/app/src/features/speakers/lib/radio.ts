import type { ContentItem, NowPlayingResponse } from "bose-api-speaker-client";

import type { StationSources } from "./speaker-radio";

/** A station a speaker can play or keep on a preset. */
export type CastStation =
  /**
   * A Radio Browser station; `streamUrl` is its stream as Radio Browser last
   * resolved it, played as a custom station where Radio Browser isn't offered.
   */
  | {
      readonly kind: "radioBrowser";
      readonly stationuuid: string;
      readonly streamUrl: string;
      readonly name: string;
      readonly favicon: string;
    }
  /** A stream added by URL; `streamUrl` is the stream itself, not a playlist. */
  | {
      readonly kind: "custom";
      readonly streamUrl: string;
      readonly name: string;
      readonly favicon: string;
    };

/** Where the server's Radio Browser adapter finds a station. */
export const radioBrowserLocation = (stationuuid: string) =>
  `/stations/byuuid/${stationuuid}`;

/** UTF-8, so names beyond Latin-1 survive the server's decoding. */
const base64 = (text: string) =>
  btoa(String.fromCodePoint(...new TextEncoder().encode(text)));

/**
 * Where the server's custom stations adapter finds a stream added by URL: the
 * location carries the stream itself, in the format other SoundTouch servers
 * use, so its presets keep working on them.
 */
export const customStationLocation = (station: {
  readonly streamUrl: string;
  readonly name: string;
  readonly favicon: string;
}) =>
  `/station?data=${encodeURIComponent(
    base64(
      JSON.stringify({
        name: station.name,
        imageUrl: station.favicon,
        streamUrl: station.streamUrl,
      }),
    ),
  )}`;

/**
 * The ContentItem that plays a station, now or from a preset, on a speaker
 * offering `sources`; `undefined` when it offers none that plays it. A Radio
 * Browser station's location names the station, not its stream: the server's
 * Radio Browser adapter looks the stream up every time it plays, so a preset
 * follows the station when it moves its stream. Where Radio Browser isn't
 * offered, the station plays as a custom station, from the stream it has now.
 * Neither location holds a server address, so they play through whichever
 * server the speaker uses.
 */
export function stationContentItem(
  station: CastStation,
  sources: StationSources,
): ContentItem | undefined {
  const item = (source: string, location: string): ContentItem => ({
    source,
    location,
    type: "stationurl",
    sourceAccount: "",
    isPresetable: true,
    itemName: station.name,
    containerArt: station.favicon,
  });
  if (station.kind === "radioBrowser" && sources.radioBrowser) {
    return item("RADIO_BROWSER", radioBrowserLocation(station.stationuuid));
  }
  if (sources.customStations && station.streamUrl !== "") {
    return item("LOCAL_INTERNET_RADIO", customStationLocation(station));
  }
  return undefined;
}

/** The speaker took the station but never started it. */
export class StationNotStartedError extends Error {
  constructor() {
    super("The speaker didn't start the station");
    this.name = "StationNotStartedError";
  }
}

export type StationPlayback = "playing" | "buffering" | "failed" | "waiting";

/**
 * Where the speaker is with a station it was asked to play. A speaker
 * accepts any station at once and only then asks the server for its stream,
 * so a station that can't play (gone, or HLS only) shows up here as an error
 * source or play status, not as a failed request.
 */
export function stationPlayback(
  nowPlaying: Pick<NowPlayingResponse, "source" | "playStatus" | "contentItem">,
  location: string,
): StationPlayback {
  const reported = nowPlaying.contentItem.location;
  // Until it switches, the speaker still reports what it played before,
  // including that station's own failure. A failed station has no location.
  if (reported && reported !== location) {
    return "waiting";
  }
  if (
    nowPlaying.source === "INVALID_SOURCE" ||
    nowPlaying.source.endsWith("_ERROR") ||
    // The API reference says INVALID_PLAY_STATUS; speakers were seen
    // sending INVALID_PLAY_STATE.
    nowPlaying.playStatus.startsWith("INVALID_PLAY_")
  ) {
    return "failed";
  }
  if (!reported) {
    return "waiting";
  }
  if (nowPlaying.playStatus === "PLAY_STATE") {
    return "playing";
  }
  if (nowPlaying.playStatus === "BUFFERING_STATE") {
    return "buffering";
  }
  return "waiting";
}

/**
 * Gaps between readbacks of the speaker's now playing, about 12 s in all: a
 * working station plays within a few seconds, a failing one errors as soon
 * as the server refuses it.
 */
export const STATION_READBACK_DELAYS_MS = [1000, 1500, 2000, 3000, 4500];

/**
 * Resolves once the speaker plays the station at `location`, and throws
 * `StationNotStartedError` when it reports an error or hasn't started it by
 * the last readback. A station still buffering then counts as started: some
 * streams take that long to fill the buffer.
 */
export async function confirmStationPlaying(
  readNowPlaying: () => Promise<Pick<
    NowPlayingResponse,
    "source" | "playStatus" | "contentItem"
  > | null>,
  location: string,
  delaysMs: readonly number[] = STATION_READBACK_DELAYS_MS,
): Promise<void> {
  let last: StationPlayback = "waiting";
  for (const delayMs of delaysMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const nowPlaying = await readNowPlaying();
    // A readback the speaker didn't answer leaves the last state standing.
    if (nowPlaying !== null) {
      last = stationPlayback(nowPlaying, location);
      if (last === "playing") {
        return;
      }
      if (last === "failed") {
        throw new StationNotStartedError();
      }
    }
  }
  if (last !== "buffering") {
    throw new StationNotStartedError();
  }
}
