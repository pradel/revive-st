import { escapeXml, type NowPlayingResponse } from "bose-api-speaker-client";

/** The Radio Browser station fields a speaker needs to play it. */
export interface CastStation {
  readonly stationuuid: string;
  readonly name: string;
  readonly favicon: string;
}

/** Where the server's Radio Browser adapter finds a station. */
export const radioBrowserLocation = (stationuuid: string) =>
  `/stations/byuuid/${stationuuid}`;

/**
 * The ContentItem that plays a Radio Browser station. Its location names the
 * station, not its stream: the server's Radio Browser adapter looks the
 * stream up every time it plays, so a preset follows the station when it
 * moves its stream. The location holds no server address either, so it plays
 * through whichever Revive ST server the speaker uses.
 */
export const buildRadioBrowserPayload = (station: CastStation): string =>
  `<ContentItem source="RADIO_BROWSER" type="stationurl" location="${escapeXml(
    radioBrowserLocation(station.stationuuid),
  )}" sourceAccount="" isPresetable="true"><itemName>${escapeXml(
    station.name,
  )}</itemName><containerArt>${escapeXml(station.favicon)}</containerArt></ContentItem>`;

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
  if (
    nowPlaying.source === "INVALID_SOURCE" ||
    nowPlaying.source.endsWith("_ERROR") ||
    // The API reference says INVALID_PLAY_STATUS; speakers were seen
    // sending INVALID_PLAY_STATE.
    nowPlaying.playStatus.startsWith("INVALID_PLAY_")
  ) {
    return "failed";
  }
  // Until it switches, the speaker still reports what it played before.
  if (nowPlaying.contentItem.location !== location) {
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
