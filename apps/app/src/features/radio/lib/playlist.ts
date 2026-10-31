/**
 * Playlists a stream URL can point to instead of a stream. SoundTouch speakers
 * play the stream itself, and never HLS, so a playlist is opened before a
 * custom station is saved.
 */
export type PlaylistKind = "m3u" | "pls" | "hls";

const KIND_BY_CONTENT_TYPE: Record<string, PlaylistKind> = {
  "application/vnd.apple.mpegurl": "hls",
  "application/x-mpegurl": "hls",
  "audio/x-mpegurl": "m3u",
  "audio/mpegurl": "m3u",
  "audio/x-scpls": "pls",
  "application/pls+xml": "pls",
};

const KIND_BY_EXTENSION: Record<string, PlaylistKind> = {
  m3u8: "hls",
  m3u: "m3u",
  pls: "pls",
};

const extension = (url: string) => {
  try {
    return /\.([a-z0-9]+)$/i.exec(new URL(url).pathname)?.[1].toLowerCase();
  } catch {
    return undefined;
  }
};

/**
 * The kind of playlist a response is, from its content type, else from the
 * URL's extension; `null` for anything else, which is taken as the stream.
 */
export function playlistKind(
  url: string,
  contentType: string,
): PlaylistKind | null {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const ext = extension(url) ?? "";
  if (Object.hasOwn(KIND_BY_CONTENT_TYPE, type)) {
    return KIND_BY_CONTENT_TYPE[type];
  }
  return Object.hasOwn(KIND_BY_EXTENSION, ext) ? KIND_BY_EXTENSION[ext] : null;
}

const isHttpUrl = (entry: string) => /^https?:\/\/\S+$/i.test(entry);

/**
 * The stream URLs a playlist lists, in order, or `"hls"` for an HLS playlist
 * that arrived labelled as a plain M3U.
 */
export function playlistEntries(
  text: string,
  kind: "m3u" | "pls",
): string[] | "hls" {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (kind === "m3u") {
    if (lines.some((line) => line.startsWith("#EXT-X-"))) {
      return "hls";
    }
    return lines.filter((line) => !line.startsWith("#") && isHttpUrl(line));
  }
  return lines
    .map((line) => /^File\d+=(.+)$/i.exec(line)?.[1].trim() ?? "")
    .filter(isHttpUrl);
}
