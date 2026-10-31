import { describe, expect, it } from "vite-plus/test";

import { playlistEntries, playlistKind } from "./playlist";

describe("playlistKind", () => {
  it("prefers the content type over the extension", () => {
    expect(playlistKind("http://a.example/live", "audio/x-scpls")).toBe("pls");
    expect(
      playlistKind(
        "http://a.example/radio.mp3",
        "audio/mpegurl; charset=utf-8",
      ),
    ).toBe("m3u");
  });

  it("falls back to the extension, ignoring the query", () => {
    expect(playlistKind("http://a.example/radio.PLS?x=1", "text/plain")).toBe(
      "pls",
    );
    expect(playlistKind("https://a.example/live/index.m3u8", "")).toBe("hls");
  });

  it("takes an audio response as the stream", () => {
    expect(playlistKind("http://a.example:8000/stream", "audio/mpeg")).toBe(
      null,
    );
  });
});

describe("playlistEntries", () => {
  it("lists an M3U's URLs, skipping comments and other lines", () => {
    const m3u = [
      "#EXTM3U",
      "#EXTINF:-1,Radio",
      "http://a.example/1.mp3",
      "",
      "relative.mp3",
      "https://a.example/2.aac",
    ].join("\r\n");
    expect(playlistEntries(m3u, "m3u")).toEqual([
      "http://a.example/1.mp3",
      "https://a.example/2.aac",
    ]);
  });

  it("spots HLS served as a plain M3U", () => {
    const hls =
      "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1\nlow.m3u8";
    expect(playlistEntries(hls, "m3u")).toBe("hls");
  });

  it("lists a PLS's files in order", () => {
    const pls = [
      "[playlist]",
      "NumberOfEntries=2",
      "File1=http://a.example:8000/live",
      "Title1=Radio",
      "file2= http://b.example/live ",
    ].join("\n");
    expect(playlistEntries(pls, "pls")).toEqual([
      "http://a.example:8000/live",
      "http://b.example/live",
    ]);
  });
});
