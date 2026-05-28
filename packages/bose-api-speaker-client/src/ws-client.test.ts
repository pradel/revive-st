// oxlint-disable typescript/no-non-null-assertion

import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from "vite-plus/test";

import { BoseWebSocketClient, parseWebSocketMessage } from "./ws-client.ts";

function createMockWS() {
  return {
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: string }) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onclose: null as ((event: { code: number }) => void) | null,
    close: vi.fn(),
  };
}

function stubWebSocket(ws: ReturnType<typeof createMockWS>) {
  const ctor = vi.fn(function ctor() {
    return ws;
  });
  vi.stubGlobal("WebSocket", ctor);
  return ctor;
}

describe("parseWebSocketMessage", () => {
  it("returns null if XML doesn't contain updates element with deviceID", () => {
    expect(parseWebSocketMessage("<invalidXml />")).toBeNull();
  });

  it("parses volume updates with full volume block", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <volumeUpdated>
          <volume deviceID="000C8A123456">
            <targetvolume>50</targetvolume>
            <actualvolume>45</actualvolume>
            <muteenabled>false</muteenabled>
          </volume>
        </volumeUpdated>
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "volume",
      volume: {
        deviceID: "000C8A123456",
        targetVolume: 50,
        actualVolume: 45,
        muteEnabled: false,
      },
    });
  });

  it("parses nowPlaying updates with full nowPlaying block", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <nowPlayingUpdated>
          <nowPlaying deviceID="000C8A123456" source="BLUETOOTH">
            <ContentItem source="BLUETOOTH" location="" sourceAccount="" isPresetable="false">
              <itemName>Phone</itemName>
            </ContentItem>
            <track>My Favorite Song</track>
            <artist>Super Artist</artist>
            <album>Super Album</album>
            <playStatus>PLAY_STATE</playStatus>
          </nowPlaying>
        </nowPlayingUpdated>
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "nowPlaying",
      nowPlaying: {
        deviceID: "000C8A123456",
        source: "BLUETOOTH",
        playStatus: "PLAY_STATE",
        track: "My Favorite Song",
        artist: "Super Artist",
        album: "Super Album",
        artUrl: undefined,
      },
    });
  });

  it("identifies basic volume signal updates with no payload", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <volumeUpdated />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "volume",
    });
  });

  it("parses nowSelection updates with preset and ContentItem", () => {
    const xml = `
      <updates deviceID="EC1127C25A50">
        <nowSelectionUpdated>
          <preset id="0">
            <ContentItem source="LOCAL_INTERNET_RADIO" location="eyJzdHJlYW1VcmwiOiJodHRwOi8vc3RyZWFtLXVrMS5yYWRpb3BhcmFkaXNlLmNvbS9hYWMtMzIwIiwibmFtZSI6IlJhZGlvIFBhcmFkaXNlIE1haW4gTWl4IChFVSkgMzIwayBBQUMiLCJpbWFnZVVybCI6IiJ9" sourceAccount="" isPresetable="true">
              <itemName>Radio Paradise Main Mix (EU) 320k AAC</itemName>
            </ContentItem>
          </preset>
        </nowSelectionUpdated>
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "EC1127C25A50",
      type: "nowSelection",
      nowSelection: {
        deviceID: "EC1127C25A50",
        preset: {
          id: 0,
          contentItem: {
            source: "LOCAL_INTERNET_RADIO",
            location:
              "eyJzdHJlYW1VcmwiOiJodHRwOi8vc3RyZWFtLXVrMS5yYWRpb3BhcmFkaXNlLmNvbS9hYWMtMzIwIiwibmFtZSI6IlJhZGlvIFBhcmFkaXNlIE1haW4gTWl4IChFVSkgMzIwayBBQUMiLCJpbWFnZVVybCI6IiJ9",
            sourceAccount: "",
            isPresetable: true,
            itemName: "Radio Paradise Main Mix (EU) 320k AAC",
          },
        },
      },
    });
  });

  it("identifies basic nowPlaying signal updates with no payload", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <nowPlayingUpdated />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "nowPlaying",
    });
  });

  it("identifies presets updates", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <presetsUpdated />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "presets",
    });
  });

  it("identifies zone updates", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <zoneUpdated />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "zone",
    });
  });

  it("identifies recents updates", () => {
    const xml = `
      <updates deviceID="EC1127C25A50">
        <recentsUpdated>
          <recents>
            <recent deviceID="EC1127C25A50" utcTime="1779980678">
              <contentItem source="LOCAL_INTERNET_RADIO" type="stationurl" location="https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion/station?data=eyJzdHJlYW1VcmwiOiJodHRwOi8vaWNlY2FzdC5yYWRpb2ZyYW5jZS5mci9maXAtaGlmaS5hYWMiLCJuYW1lIjoiRklQIiwiaW1hZ2VVcmwiOiIifQ%3D%3D" sourceAccount="revivest-user" isPresetable="true">
                <itemName>FIP</itemName>
              </contentItem>
            </recent>
          </recents>
        </recentsUpdated>
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "EC1127C25A50",
      type: "recents",
      recents: {
        deviceID: "EC1127C25A50",
        recents: [
          {
            deviceID: "EC1127C25A50",
            utcTime: 1779980678,
            contentItem: {
              source: "LOCAL_INTERNET_RADIO",
              type: "stationurl",
              location:
                "https://api.revivest.app/core02/svc-bmx-adapter-orion/prod/orion/station?data=eyJzdHJlYW1VcmwiOiJodHRwOi8vaWNlY2FzdC5yYWRpb2ZyYW5jZS5mci9maXAtaGlmaS5hYWMiLCJuYW1lIjoiRklQIiwiaW1hZ2VVcmwiOiIifQ%3D%3D",
              sourceAccount: "revivest-user",
              isPresetable: true,
              itemName: "FIP",
            },
          },
        ],
      },
    });
  });

  it("parses nameUpdated events", () => {
    const xml = `
      <updates deviceID="EC1127C25A50">
        <nameUpdated>Bose SoundTouch 10</nameUpdated>
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "EC1127C25A50",
      type: "nameUpdated",
      name: "Bose SoundTouch 10",
    });
  });

  it("unescapes XML entities in nameUpdated events", () => {
    const xml = `
      <updates deviceID="DEV001">
        <nameUpdated>Living &amp; Room</nameUpdated>
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "DEV001",
      type: "nameUpdated",
      name: "Living & Room",
    });
  });

  it("returns unknown for unrecognized event types", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <bassUpdated />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "unknown",
    });
  });

  it("parses connectionState updates", () => {
    const xml = `
      <updates deviceID="000C8A123456">
        <connectionStateUpdated state="NETWORK_WIFI_CONNECTED" up="true" signal="GOOD_SIGNAL" />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "000C8A123456",
      type: "connectionState",
      connectionState: {
        deviceID: "000C8A123456",
        state: "NETWORK_WIFI_CONNECTED",
        up: true,
        signal: "GOOD_SIGNAL",
      },
    });
  });

  it("parses connectionState updates with poor signal", () => {
    const xml = `
      <updates deviceID="EC1127C25A50">
        <connectionStateUpdated state="NETWORK_WIFI_CONNECTED" up="true" signal="POOR_SIGNAL" />
      </updates>
    `;
    expect(parseWebSocketMessage(xml)).toEqual({
      deviceID: "EC1127C25A50",
      type: "connectionState",
      connectionState: {
        deviceID: "EC1127C25A50",
        state: "NETWORK_WIFI_CONNECTED",
        up: true,
        signal: "POOR_SIGNAL",
      },
    });
  });
});

describe("BoseWebSocketClient", () => {
  let wsMock: ReturnType<typeof createMockWS>;
  let wsCtor: ReturnType<typeof stubWebSocket>;
  let client: BoseWebSocketClient;
  const onUpdate = vi.fn();
  const onDisconnect = vi.fn();
  const onError = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    wsMock = createMockWS();
    wsCtor = stubWebSocket(wsMock);
    onUpdate.mockClear();
    onDisconnect.mockClear();
    onError.mockClear();
    client = new BoseWebSocketClient({
      host: "192.168.1.100",
      deviceID: "DEV001",
      onUpdate,
      onDisconnect,
      onError,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("connect", () => {
    it("creates WebSocket with correct URL and gabbo protocol", () => {
      client.connect();
      expect(wsCtor).toHaveBeenCalledWith("ws://192.168.1.100:8080", "gabbo");
    });

    it("resets reconnect attempts on open", () => {
      client.connect();
      expect(wsMock.onopen).not.toBeNull();
      wsMock.onopen!();
      expect(onDisconnect).not.toHaveBeenCalled();
    });

    it("fires onUpdate when a parsed message is received", () => {
      client.connect();
      expect(wsMock.onmessage).not.toBeNull();

      const xml = `<updates deviceID="DEV001"><volumeUpdated /></updates>`;
      wsMock.onmessage!({ data: xml });

      expect(onUpdate).toHaveBeenCalledWith({
        deviceID: "DEV001",
        type: "volume",
      });
    });

    it("does not fire onUpdate for unparseable messages", () => {
      client.connect();
      wsMock.onmessage!({ data: "<invalid />" });
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("fires onError callback on WebSocket error", () => {
      client.connect();
      expect(wsMock.onerror).not.toBeNull();
      const err = new Event("error");
      wsMock.onerror!(err);
      expect(onError).toHaveBeenCalled();
    });

    it("fires onDisconnect and attempts reconnect on unintentional close", () => {
      client.connect();
      expect(wsMock.onclose).not.toBeNull();

      wsMock.onclose!({ code: 1006 });

      expect(onDisconnect).toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(wsCtor).toHaveBeenCalledTimes(2);
    });

    it("does not reconnect when closed intentionally", () => {
      client.connect();
      const savedOnClose = wsMock.onclose;
      client.close();
      savedOnClose!({ code: 1000 });
      vi.advanceTimersByTime(2000);
      expect(wsCtor).toHaveBeenCalledTimes(1);
    });

    it("reconnects with exponential backoff", () => {
      client.connect();
      expect(wsCtor).toHaveBeenCalledTimes(1);

      wsMock.onclose!({ code: 1006 });
      vi.advanceTimersByTime(2000);
      expect(wsCtor).toHaveBeenCalledTimes(2);

      wsMock.onclose!({ code: 1006 });
      vi.advanceTimersByTime(2000);
      expect(wsCtor).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(2000);
      expect(wsCtor).toHaveBeenCalledTimes(3);
    });

    it("stops reconnecting after max attempts", () => {
      client.connect();
      expect(wsCtor).toHaveBeenCalledTimes(1);

      for (let attempt = 1; attempt <= 22; attempt++) {
        wsMock.onclose!({ code: 1006 });
        vi.advanceTimersByTime(Math.min(1000 * 2 ** attempt, 15000));
      }

      expect(wsCtor).toHaveBeenCalledTimes(23);

      wsMock.onclose!({ code: 1006 });
      vi.advanceTimersByTime(15000);
      expect(wsCtor).toHaveBeenCalledTimes(23);
    });
  });

  describe("close", () => {
    it("closes the underlying WebSocket", () => {
      client.connect();
      client.close();
      expect(wsMock.close).toHaveBeenCalled();
    });

    it("clears pending reconnect timeout", () => {
      client.connect();
      wsMock.onclose!({ code: 1006 });
      client.close();
      vi.advanceTimersByTime(2000);
      expect(wsCtor).toHaveBeenCalledTimes(1);
    });

    it("nulls event handlers before closing to prevent stale onclose from reconnecting", () => {
      client.connect();
      client.close();

      expect(wsMock.onopen).toBeNull();
      expect(wsMock.onmessage).toBeNull();
      expect(wsMock.onerror).toBeNull();
      expect(wsMock.onclose).toBeNull();
    });
  });
});
