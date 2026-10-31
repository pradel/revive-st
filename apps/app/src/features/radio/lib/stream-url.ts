// Streams never end, so a response must resolve on its headers: React
// Native's own fetch waits for the whole body.
import { fetch } from "expo/fetch";

import { playlistEntries, playlistKind } from "./playlist";

/** Why a URL can't be saved as a custom station. */
export type StreamUrlProblem =
  | "invalid"
  | "hls"
  | "empty-playlist"
  | "unreachable";

export class StreamUrlError extends Error {
  readonly problem: StreamUrlProblem;

  constructor(problem: StreamUrlProblem) {
    super(`Stream URL rejected: ${problem}`);
    this.name = "StreamUrlError";
    this.problem = problem;
  }
}

const REQUEST_TIMEOUT_MS = 8000;

/** A playlist can list another playlist; one level of nesting is enough. */
const MAX_PLAYLIST_DEPTH = 2;

export const isHttpUrl = (url: string) => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * The stream a URL plays, as a speaker needs it: the URL itself when it
 * answers with audio, else the first stream of the M3U or PLS playlist it
 * serves. Checked from the phone, which shares the speaker's network, so
 * streams on the home network work too. Throws `StreamUrlError` for HLS,
 * which speakers can't play, an empty playlist, or a URL that doesn't answer.
 */
export async function resolveStreamUrl(
  url: string,
  depth = 0,
): Promise<string> {
  if (!isHttpUrl(url)) {
    throw new StreamUrlError("invalid");
  }
  if (playlistKind(url, "") === "hls") {
    throw new StreamUrlError("hls");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      throw new StreamUrlError("unreachable");
    }
    if (!response.ok) {
      throw new StreamUrlError("unreachable");
    }
    const kind = playlistKind(url, response.headers.get("content-type") ?? "");
    if (kind === "hls") {
      throw new StreamUrlError("hls");
    }
    if (kind === null) {
      return url;
    }
    const entries = playlistEntries(await response.text(), kind);
    if (entries === "hls") {
      throw new StreamUrlError("hls");
    }
    if (entries.length === 0) {
      throw new StreamUrlError("empty-playlist");
    }
    return depth < MAX_PLAYLIST_DEPTH
      ? await resolveStreamUrl(entries[0], depth + 1)
      : entries[0];
  } finally {
    clearTimeout(timeoutId);
    // Stops downloading the stream once its headers said what it is.
    controller.abort();
  }
}
