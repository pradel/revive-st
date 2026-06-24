import { Result } from "better-result";
import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

import { Speaker } from "./speaker.ts";

const IP = "192.168.1.100";
const DEVICE_ID = "D05FB8A9591D";

function mockFetch(status: number, body: string) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () =>
      Promise.resolve(new Response(body, { status })),
    );
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

  it("powerToggle() sends POWER key press and release", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.powerToggle();
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="press" sender="bose-client">POWER</key>',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="release" sender="bose-client">POWER</key>',
      }),
    );
  });

  it("savePreset() sends PRESET key press and release after a delay", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.savePreset(1);
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="press" sender="bose-client">PRESET_1</key>',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="release" sender="bose-client">PRESET_1</key>',
      }),
    );
  });

  it("triggerKey() sends custom key press and release", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.triggerKey("PLAY_PAUSE" as any);
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="press" sender="bose-client">PLAY_PAUSE</key>',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="release" sender="bose-client">PLAY_PAUSE</key>',
      }),
    );
  });

  it("setBass() sends bass command", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.setBass(-2);
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/bass"),
      expect.objectContaining({
        method: "POST",
        body: "<bass>-2</bass>",
      }),
    );
  });

  it("setName() sends name command", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.setName("Living Room");
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/name"),
      expect.objectContaining({
        method: "POST",
        body: "<name>Living Room</name>",
      }),
    );
  });

  it("initialize() fetches full speaker state", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = input as string;
        if (url.includes("/info")) {
          return Promise.resolve(
            new Response("<info><deviceID>TEST1234</deviceID></info>", {
              status: 200,
            }),
          );
        }
        if (url.includes("/nowPlaying")) {
          return Promise.resolve(
            new Response('<nowPlaying source="STANDBY"></nowPlaying>', {
              status: 200,
            }),
          );
        }
        if (url.includes("/volume")) {
          return Promise.resolve(
            new Response(
              "<volume><actualvolume>50</actualvolume><muteenabled>false</muteenabled></volume>",
              { status: 200 },
            ),
          );
        }
        if (url.includes("/presets")) {
          return Promise.resolve(
            new Response("<presets></presets>", { status: 200 }),
          );
        }
        if (url.includes("/bassCapabilities")) {
          return Promise.resolve(
            new Response(
              "<bassCapabilities><bassAvailable>true</bassAvailable><bassMin>-9</bassMin><bassMax>9</bassMax><bassDefault>0</bassDefault></bassCapabilities>",
              { status: 200 },
            ),
          );
        }
        if (url.includes("/bass")) {
          return Promise.resolve(
            new Response("<bass><actualbass>0</actualbass></bass>", {
              status: 200,
            }),
          );
        }
        if (url.includes("/capabilities")) {
          return Promise.resolve(
            new Response("<capabilities></capabilities>", { status: 200 }),
          );
        }
        if (url.includes("/audiodspcontrols")) {
          return Promise.resolve(
            new Response("<audiodspcontrols></audiodspcontrols>", {
              status: 200,
            }),
          );
        }
        if (url.includes("/audioproducttonecontrols")) {
          return Promise.resolve(
            new Response(
              "<audioproducttonecontrols></audioproducttonecontrols>",
              { status: 200 },
            ),
          );
        }
        if (url.includes("/audioproductlevelcontrols")) {
          return Promise.resolve(
            new Response(
              "<audioproductlevelcontrols></audioproductlevelcontrols>",
              { status: 200 },
            ),
          );
        }

        return Promise.resolve(
          new Response("<status>OK</status>", { status: 200 }),
        );
      });
    const result = await speaker.initialize();
    expect(Result.isOk(result)).toBe(true);
    // initialize() calls getInfo, getNowPlaying, getVolume, getPresets, getBass, getBassCapabilities, getCapabilities, getAudioDspControls, getAudioProductToneControls, getAudioProductLevelControls
    // That's 10 requests. We'll just verify it made multiple GET requests.
    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.some((call) => (call[0] as string).includes("/info"))).toBe(
      true,
    );
    expect(
      calls.some((call) => (call[0] as string).includes("/nowPlaying")),
    ).toBe(true);
    expect(calls.some((call) => (call[0] as string).includes("/volume"))).toBe(
      true,
    );
  });

  it("handles 500 error correctly without throwing", async () => {
    mockFetch(500, "<error>Internal Server Error</error>");
    const result = await speaker.powerToggle();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("HttpError");
    }
  });
});
