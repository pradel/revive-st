import { Result } from "better-result";
import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

import { Speaker } from "./speaker.ts";

const IP = "192.168.1.100";
const DEVICE_ID = "D05FB8A9591D";

function mockFetch(status: number, body: string) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(body, { status }));
}

describe("Speaker", () => {
  let speaker: Speaker;

  beforeEach(() => {
    vi.restoreAllMocks();
    speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID });
  });

  it("play() sends PLAY key press", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.play();
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/key"),
      expect.objectContaining({
        method: "POST",
        body: '<key state="press" sender="bose-client">PLAY</key>',
      }),
    );
  });

  it("pause() sends PAUSE key press", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.pause();
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/key"),
      expect.objectContaining({
        method: "POST",
        body: '<key state="press" sender="bose-client">PAUSE</key>',
      }),
    );
  });

  it("setVolume() sends volume command", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.setVolume(50);
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/volume"),
      expect.objectContaining({
        method: "POST",
        body: "<volume>50</volume>",
      }),
    );
  });

  it("mute() sends MUTE key press", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.mute();
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/key"),
      expect.objectContaining({
        method: "POST",
        body: '<key state="press" sender="bose-client">MUTE</key>',
      }),
    );
  });

  it("playPreset() sends PRESET key press", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.playPreset(3);
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/key"),
      expect.objectContaining({
        method: "POST",
        body: '<key state="press" sender="bose-client">PRESET_3</key>',
      }),
    );
  });

  it("groupWith() sends setZone with members", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.groupWith([
      { ipaddress: "192.168.1.101", macAddress: "ABC123DEF456" },
    ]);
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/setZone"),
      expect.objectContaining({
        method: "POST",
        body: `<zone master="${DEVICE_ID}" senderIPAddress="${IP}"><member ipaddress="192.168.1.101">ABC123DEF456</member></zone>`,
      }),
    );
  });
});
