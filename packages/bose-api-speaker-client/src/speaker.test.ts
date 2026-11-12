import { Result } from "better-result";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { NetworkError } from "./errors.ts";
import type { BalanceResponse, SpeakerGroup } from "./index.ts";
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

function createMockWS() {
  return {
    readyState: 1,
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onclose: null as ((event: { code: number }) => void) | null,
    send: vi.fn(),
    close: vi.fn(),
  };
}

function stubWebSocket(ws: ReturnType<typeof createMockWS>) {
  function WebSocketMock() {
    return ws;
  }
  const ctor = vi.fn(WebSocketMock);
  vi.stubGlobal("WebSocket", ctor);
  return ctor;
}

// Captured from a pair of SoundTouch 10s (firmware 27.0.6).
const PAIRED_GROUP_XML = `<?xml version="1.0" encoding="UTF-8" ?><group id="3271058"><name>Living room + Office</name><masterDeviceId>0CAE7D6298E9</masterDeviceId><roles><groupRole><deviceId>0CAE7D6298E9</deviceId><role>LEFT</role><ipAddress>192.168.1.195</ipAddress></groupRole><groupRole><deviceId>EC1127C25A50</deviceId><role>RIGHT</role><ipAddress>192.168.1.189</ipAddress></groupRole></roles><senderIPAddress>192.168.1.195</senderIPAddress><status>GROUP_OK</status></group>`;
const PAIRED_GROUP: SpeakerGroup = {
  id: "3271058",
  name: "Living room + Office",
  masterDeviceId: "0CAE7D6298E9",
  roles: [
    { deviceId: "0CAE7D6298E9", role: "LEFT", ipAddress: "192.168.1.195" },
    { deviceId: "EC1127C25A50", role: "RIGHT", ipAddress: "192.168.1.189" },
  ],
  senderIpAddress: "192.168.1.195",
  status: "GROUP_OK",
};

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
        body: '<key state="press" sender="Gabbo">PLAY</key>',
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
        body: '<key state="press" sender="Gabbo">PAUSE</key>',
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
        body: '<key state="press" sender="Gabbo">MUTE</key>',
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
        body: '<key state="press" sender="Gabbo">PRESET_3</key>',
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
        body: '<key state="press" sender="Gabbo">POWER</key>',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="release" sender="Gabbo">POWER</key>',
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
        body: '<key state="press" sender="Gabbo">PRESET_1</key>',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="release" sender="Gabbo">PRESET_1</key>',
      }),
    );
  });

  it("triggerKey() sends custom key press and release", async () => {
    const fetchMock = mockFetch(200, "<status>OK</status>");
    const result = await speaker.triggerKey("PLAY_PAUSE");
    expect(Result.isOk(result)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="press" sender="Gabbo">PLAY_PAUSE</key>',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/key"),
      expect.objectContaining({
        body: '<key state="release" sender="Gabbo">PLAY_PAUSE</key>',
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

  it("setName() puts the new name in the state once the speaker accepts it", async () => {
    mockFetch(200, "<status>OK</status>");
    const onStateUpdate = vi.fn();
    speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID, onStateUpdate });

    await speaker.setName("Living Room");

    expect(speaker.getState().name).toBe("Living Room");
    expect(onStateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Living Room" }),
    );
  });

  it("setName() keeps the state when the speaker refuses the name", async () => {
    mockFetch(500, "<error>Internal Server Error</error>");
    const onStateUpdate = vi.fn();
    speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID, onStateUpdate });

    await speaker.setName("Living Room");

    expect(speaker.getState().name).toBeUndefined();
    expect(onStateUpdate).not.toHaveBeenCalled();
  });

  it("initialize() fetches full speaker state", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = input as string;
        if (url.includes("/info")) {
          return Promise.resolve(
            new Response(
              "<info><deviceID>TEST1234</deviceID><name>Test Speaker</name><type>SoundTouch 10</type></info>",
              {
                status: 200,
              },
            ),
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
    expect(result.isOk()).toBe(true);

    const calls = fetchMock.mock.calls;
    const endpoints = [
      "/info",
      "/nowPlaying",
      "/volume",
      "/presets",
      "/bassCapabilities",
      "/bass",
      "/capabilities",
      "/audiodspcontrols",
      "/audioproducttonecontrols",
      "/audioproductlevelcontrols",
    ];
    endpoints.forEach((ep) => {
      expect(calls.some((call) => (call[0] as string).includes(ep))).toBe(true);
    });

    const state = speaker.getState();
    expect(state.name).toBe("Test Speaker");
    expect(state.type).toBe("SoundTouch 10");
    expect(state.nowPlaying?.source).toBe("STANDBY");
    expect(state.volume).toBe(50);
    expect(state.isMuted).toBe(false);
    expect(state.bassCapabilities?.bassAvailable).toBe(true);
    expect(state.bassCapabilities?.bassMin).toBe(-9);
    expect(state.bassCapabilities?.bassMax).toBe(9);
    expect(state.bass).toBe(0);
  });

  it("initialize() discards an earlier call that resolves after a later one", async () => {
    const staleBassRequested = Promise.withResolvers<undefined>();
    const staleBass = Promise.withResolvers<Response>();
    let bassCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input as string;
      if (url.endsWith("/bass")) {
        bassCalls += 1;
        if (bassCalls === 1) {
          // The first refresh's read is slow and returns an outdated value.
          staleBassRequested.resolve(undefined);
          return staleBass.promise;
        }
        return new Response("<bass><actualbass>0</actualbass></bass>", {
          status: 200,
        });
      }
      return new Response("<status>OK</status>", { status: 200 });
    });
    const onStateUpdate = vi.fn();
    speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID, onStateUpdate });

    const stale = speaker.initialize();
    await staleBassRequested.promise;
    await speaker.initialize();
    staleBass.resolve(
      new Response("<bass><actualbass>-5</actualbass></bass>", { status: 200 }),
    );
    await stale;

    expect(speaker.getState().bass).toBe(0);
    expect(onStateUpdate).toHaveBeenCalledTimes(1);
  });

  describe("stereo pair", () => {
    function mockSpeaker(type: string) {
      return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = input as string;
        let body = "<status>OK</status>";
        if (url.endsWith("/info")) {
          body = `<info deviceID="${DEVICE_ID}"><name>Living room</name><type>${type}</type></info>`;
        } else if (url.endsWith("/getGroup") || url.endsWith("/addGroup")) {
          body = PAIRED_GROUP_XML;
        } else if (url.endsWith("/removeGroup")) {
          body = '<?xml version="1.0" encoding="UTF-8" ?><group />';
        }
        return Promise.resolve(new Response(body, { status: 200 }));
      });
    }

    it("initialize() reads the pair of a SoundTouch 10", async () => {
      mockSpeaker("SoundTouch 10");
      await speaker.initialize();
      expect(speaker.getState().group).toEqual(PAIRED_GROUP);
    });

    it("initialize() never asks other models for a pair", async () => {
      const fetchMock = mockSpeaker("SoundTouch 20");
      await speaker.initialize();
      expect(
        fetchMock.mock.calls.some(([url]) =>
          (url as string).endsWith("/getGroup"),
        ),
      ).toBe(false);
      expect(speaker.getState().group).toBeUndefined();
    });

    it("addGroup() and removeGroup() keep the state's pair current", async () => {
      mockSpeaker("SoundTouch 10");
      const onStateUpdate = vi.fn();
      speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID, onStateUpdate });

      await speaker.addGroup({
        name: PAIRED_GROUP.name,
        masterDeviceId: PAIRED_GROUP.masterDeviceId,
        roles: PAIRED_GROUP.roles,
      });
      expect(speaker.getState().group).toEqual(PAIRED_GROUP);
      expect(onStateUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ group: PAIRED_GROUP }),
      );

      await speaker.removeGroup();
      expect(speaker.getState().group).toBeNull();
    });
  });

  it("handles 500 error correctly without throwing", async () => {
    mockFetch(500, "<error>Internal Server Error</error>");
    const result = await speaker.powerToggle();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.name).toBe("HttpError");
    }
  });

  describe("connect", () => {
    let wsMock: ReturnType<typeof createMockWS>;

    beforeEach(() => {
      vi.useFakeTimers();
      wsMock = createMockWS();
      stubWebSocket(wsMock);
    });

    afterEach(() => {
      speaker.disconnect();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("reports connecting until the socket opens", () => {
      speaker.connect();
      expect(speaker.getState().connectionState).toBe("connecting");

      wsMock.onopen?.();
      expect(speaker.getState().connectionState).toBe("connected");
    });

    it("reports disconnected when the socket drops, and connected again when it reopens", () => {
      const fetchMock = mockFetch(500, "");
      speaker.connect();
      wsMock.onopen?.();
      expect(fetchMock).not.toHaveBeenCalled();

      wsMock.onclose?.({ code: 1006 });
      expect(speaker.getState().connectionState).toBe("disconnected");

      vi.advanceTimersByTime(2000);
      wsMock.onopen?.();
      expect(speaker.getState().connectionState).toBe("connected");
      // Notifications sent while the socket was down were missed.
      expect(fetchMock).toHaveBeenCalled();
    });

    it("keeps following the socket when the speaker reports its network state", () => {
      const fetchMock = mockFetch(500, "");
      speaker.connect();
      wsMock.onopen?.();

      wsMock.onmessage?.({
        data: `<updates deviceID="${DEVICE_ID}"><connectionStateUpdated state="NETWORK_WIFI_CONNECTED" signal="GOOD_SIGNAL" /></updates>`,
      });
      expect(speaker.getState().connectionState).toBe("connected");

      wsMock.onclose?.({ code: 1006 });
      vi.advanceTimersByTime(2000);
      wsMock.onopen?.();
      expect(speaker.getState().connectionState).toBe("connected");
      expect(fetchMock).toHaveBeenCalled();
    });

    it("follows the pair from groupUpdated notifications", () => {
      // Once paired, it reads the pair's balance.
      mockFetch(500, "");
      const onStateUpdate = vi.fn();
      speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID, onStateUpdate });
      speaker.connect();
      wsMock.onopen?.();

      wsMock.onmessage?.({
        data: `<updates deviceID='${DEVICE_ID}'><groupUpdated>${PAIRED_GROUP_XML.replace(/^<\?xml[^>]*\?>/, "")}</groupUpdated></updates>`,
      });
      expect(speaker.getState().group).toEqual(PAIRED_GROUP);
      expect(onStateUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ group: PAIRED_GROUP }),
      );

      wsMock.onmessage?.({
        data: `<updates deviceID='${DEVICE_ID}'><groupUpdated><group /></groupUpdated></updates>`,
      });
      expect(speaker.getState().group).toBeNull();
    });
  });

  describe("balance", () => {
    let wsMock: ReturnType<typeof createMockWS>;
    let paired: boolean;
    let target: number;
    let fetchMock: ReturnType<typeof mockFetch>;

    const balance = (targetBalance: number): BalanceResponse => ({
      deviceID: DEVICE_ID,
      balanceAvailable: true,
      balanceMin: -7,
      balanceMax: 7,
      balanceDefault: 0,
      targetBalance,
      actualBalance: targetBalance,
    });
    const balanceRead = () =>
      fetchMock.mock.calls.filter(([url]) =>
        (url as string).endsWith("/balance"),
      ).length;

    beforeEach(() => {
      vi.useFakeTimers();
      wsMock = createMockWS();
      stubWebSocket(wsMock);
      paired = true;
      target = 0;
      fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input) => {
          const url = input as string;
          let body = "<status>OK</status>";
          if (url.endsWith("/info")) {
            body = `<info deviceID="${DEVICE_ID}"><name>Living room</name><type>SoundTouch 10</type></info>`;
          } else if (url.endsWith("/getGroup")) {
            body = paired ? PAIRED_GROUP_XML : "<group />";
          } else if (url.endsWith("/balance")) {
            body = `<balance deviceID="${DEVICE_ID}"><balanceAvailable>true</balanceAvailable><balanceMin>-7</balanceMin><balanceMax>7</balanceMax><balanceDefault>0</balanceDefault><targetBalance>${target}</targetBalance><actualBalance>${target}</actualBalance></balance>`;
          }
          return Promise.resolve(new Response(body, { status: 200 }));
        });
    });

    afterEach(() => {
      speaker.disconnect();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("initialize() reads the balance of a paired SoundTouch 10", async () => {
      await speaker.initialize();
      expect(speaker.getState().balance).toEqual(balance(0));
    });

    it("initialize() reads no balance while unpaired", async () => {
      paired = false;
      await speaker.initialize();
      expect(speaker.getState().balance).toBeNull();
      expect(balanceRead()).toBe(0);
    });

    it("setBalance() writes over the WebSocket, within the speaker's range", async () => {
      speaker.connect();
      wsMock.onopen?.();
      await speaker.initialize();

      void speaker.setBalance(12);
      expect(wsMock.send).toHaveBeenCalledWith(
        `<msg><header deviceID="${DEVICE_ID}" url="balance" method="POST"><request requestID="1"><info mainNode="balanceSet" type="new"/></request></header><body><balance><targetBalance>7</targetBalance></balance></body></msg>`,
      );
    });

    it("setBalance() puts the balance the speaker replies with in the state, without reading it again", async () => {
      // Captured from a SoundTouch 10 (firmware 27.0.6) answering a write of
      // -2; a `/balance` read right then still reports the previous value.
      const CAPTURED_REPLY = `<?xml version="1.0" encoding="UTF-8" ?><msg><header deviceID="0CAE7D6298E9" url="balance" method="POST"><request requestID="77" msgType="RESPONSE"><info mainNode="balanceSet" type="new" /></request></header><body><balance deviceID="0CAE7D6298E9"><balanceAvailable>true</balanceAvailable><balanceMin>-7</balanceMin><balanceMax>7</balanceMax><balanceDefault>0</balanceDefault><targetBalance>-2</targetBalance><actualBalance>-2</actualBalance></balance></body></msg>`;
      const onStateUpdate = vi.fn();
      speaker = new Speaker({
        ip: IP,
        deviceID: "0CAE7D6298E9",
        onStateUpdate,
      });
      speaker.connect();
      wsMock.onopen?.();
      await speaker.initialize();
      const readsBefore = balanceRead();

      const pending = speaker.setBalance(-2);
      wsMock.onmessage?.({
        data: CAPTURED_REPLY.replace('requestID="77"', 'requestID="1"'),
      });

      expect((await pending).isOk()).toBe(true);
      const applied = { ...balance(-2), deviceID: "0CAE7D6298E9" };
      expect(speaker.getState().balance).toEqual(applied);
      expect(onStateUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ balance: applied }),
      );
      expect(balanceRead()).toBe(readsBefore);
    });

    it("setBalance() fails while the WebSocket isn't connected", async () => {
      await speaker.initialize();
      const result = await speaker.setBalance(-2);
      expect(result.isErr() && result.error).toBeInstanceOf(NetworkError);
    });

    it("reads the balance again when the speaker says it changed", async () => {
      const onStateUpdate = vi.fn();
      speaker = new Speaker({ ip: IP, deviceID: DEVICE_ID, onStateUpdate });
      speaker.connect();
      wsMock.onopen?.();
      await speaker.initialize();

      target = -2;
      wsMock.onmessage?.({
        data: `<updates deviceID='${DEVICE_ID}'><balanceUpdated></balanceUpdated></updates>`,
      });
      await vi.waitFor(() => {
        expect(onStateUpdate).toHaveBeenLastCalledWith(
          expect.objectContaining({ balance: balance(-2) }),
        );
      });
    });

    it("reads the balance once paired, and has none once unpaired", async () => {
      paired = false;
      speaker.connect();
      wsMock.onopen?.();
      await speaker.initialize();

      wsMock.onmessage?.({
        data: `<updates deviceID='${DEVICE_ID}'><groupUpdated>${PAIRED_GROUP_XML.replace(/^<\?xml[^>]*\?>/, "")}</groupUpdated></updates>`,
      });
      await vi.waitFor(() => {
        expect(speaker.getState().balance).toEqual(balance(0));
      });

      wsMock.onmessage?.({
        data: `<updates deviceID='${DEVICE_ID}'><groupUpdated><group /></groupUpdated></updates>`,
      });
      expect(speaker.getState().balance).toBeNull();
    });
  });
});
