import { Result } from "better-result";
import { describe, expect, it, vi } from "vitest";

import { ApiError, HttpError, NetworkError, XmlParseError } from "./errors.ts";
import { boseSpeakerClient } from "./index.ts";
import type {
  BassCapabilitiesResponse,
  BassResponse,
  BoseSpeakerClient,
  CapabilitiesResponse,
  InfoResponse,
  NowPlayingResponse,
  PresetsResponse,
  SourcesResponse,
  VolumeResponse,
  ZoneResponse,
} from "./index.ts";

const IP = "192.168.1.100";
const BASE = `http://${IP}:8090`;
const DEVICE_ID = "D05FB8A9591D";

function mockFetch(status: number, body: string) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(body, { status }));
}

function unwrapOk<T>(result: unknown): T {
  if (!Result.isOk(result as never)) {
    throw new Error("Expected Ok but got Err");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any).value as T;
}

describe("boseSpeakerClient", () => {
  let client: BoseSpeakerClient;

  beforeEach(() => {
    client = boseSpeakerClient({ ip: IP });
    vi.restoreAllMocks();
  });

  it("uses custom port", () => {
    const c = boseSpeakerClient({ ip: IP, port: 8080 });
    mockFetch(
      200,
      '<volume deviceID="D"><targetvolume>10</targetvolume><actualvolume>10</actualvolume><muteenabled>false</muteenabled></volume>',
    );
    return c.getVolume();
  });

  describe("/key", () => {
    it("sends key press POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.pressKey({
        key: "PLAY" as const,
        state: "press" as const,
        sender: "test",
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/key`,
        expect.objectContaining({
          method: "POST",
          body: '<key state="press" sender="test">PLAY</key>',
        }),
      );
    });
  });

  describe("/select", () => {
    it("sends select source POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.selectSource({ source: "AUX" });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/select`,
        expect.objectContaining({
          method: "POST",
          body: '<ContentItem source="AUX"></ContentItem>',
        }),
      );
    });

    it("sends select source POST with sourceAccount", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.selectSource({
        source: "PRODUCT",
        sourceAccount: "TV",
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/select`,
        expect.objectContaining({
          body: '<ContentItem source="PRODUCT" sourceAccount="TV"></ContentItem>',
        }),
      );
    });
  });

  describe("/sources", () => {
    it("parses sources response", async () => {
      mockFetch(
        200,
        `<sources deviceID="${DEVICE_ID}">
          <sourceItem source="AUX" sourceAccount="AUX" status="READY">Aux</sourceItem>
          <sourceItem source="BLUETOOTH" sourceAccount="" status="UNAVAILABLE">Bluetooth</sourceItem>
        </sources>`,
      );
      const result = await client.getSources();
      const val = unwrapOk<SourcesResponse>(result);
      expect(val.deviceID).toBe(DEVICE_ID);
      expect(val.sourceItems).toHaveLength(2);
      expect(val.sourceItems[0].source).toBe("AUX");
      expect(val.sourceItems[0].status).toBe("READY");
      expect(val.sourceItems[1].source).toBe("BLUETOOTH");
      expect(val.sourceItems[1].status).toBe("UNAVAILABLE");
    });
  });

  describe("/bassCapabilities", () => {
    it("parses bassCapabilities response", async () => {
      mockFetch(
        200,
        `<bassCapabilities deviceID="${DEVICE_ID}">
          <bassAvailable>true</bassAvailable>
          <bassMin>-10</bassMin>
          <bassMax>10</bassMax>
          <bassDefault>0</bassDefault>
        </bassCapabilities>`,
      );
      const val = unwrapOk<BassCapabilitiesResponse>(
        await client.getBassCapabilities(),
      );
      expect(val.bassAvailable).toBe(true);
      expect(val.bassMin).toBe(-10);
      expect(val.bassMax).toBe(10);
      expect(val.bassDefault).toBe(0);
    });
  });

  describe("/bass", () => {
    it("parses getBass response", async () => {
      mockFetch(
        200,
        `<bass deviceID="${DEVICE_ID}">
          <targetbass>5</targetbass>
          <actualbass>5</actualbass>
        </bass>`,
      );
      const val = unwrapOk<BassResponse>(await client.getBass());
      expect(val.targetbass).toBe(5);
      expect(val.actualbass).toBe(5);
    });

    it("sends setBass POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setBass(7);
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/bass`,
        expect.objectContaining({
          method: "POST",
          body: "<bass>7</bass>",
        }),
      );
    });
  });

  describe("/getZone", () => {
    it("parses getZone response", async () => {
      mockFetch(
        200,
        `<zone master="${DEVICE_ID}">
          <member ipaddress="192.168.1.101">ABC123DEF456</member>
        </zone>`,
      );
      const val = unwrapOk<ZoneResponse>(await client.getZone());
      expect(val.master).toBe(DEVICE_ID);
      expect(val.members).toHaveLength(1);
      expect(val.members[0].ipaddress).toBe("192.168.1.101");
    });
  });

  describe("/setZone", () => {
    it("sends setZone POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setZone({
        master: DEVICE_ID,
        senderIpAddress: IP,
        members: [{ ipaddress: "192.168.1.101", macAddress: "ABC123" }],
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/setZone`,
        expect.objectContaining({
          method: "POST",
          body: `<zone master="${DEVICE_ID}" senderIPAddress="${IP}"><member ipaddress="192.168.1.101">ABC123</member></zone>`,
        }),
      );
    });
  });

  describe("/addZoneSlave", () => {
    it("sends addZoneSlave POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.addZoneSlave({
        master: DEVICE_ID,
        members: [{ ipaddress: "192.168.1.101", macAddress: "ABC123" }],
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/addZoneSlave`,
        expect.objectContaining({
          method: "POST",
          body: `<zone master="${DEVICE_ID}"><member ipaddress="192.168.1.101">ABC123</member></zone>`,
        }),
      );
    });
  });

  describe("/removeZoneSlave", () => {
    it("sends removeZoneSlave POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.removeZoneSlave({
        master: DEVICE_ID,
        members: [{ ipaddress: "192.168.1.101", macAddress: "ABC123" }],
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/removeZoneSlave`,
        expect.objectContaining({
          method: "POST",
          body: `<zone master="${DEVICE_ID}"><member ipaddress="192.168.1.101">ABC123</member></zone>`,
        }),
      );
    });
  });

  describe("/nowPlaying", () => {
    it("parses nowPlaying response", async () => {
      mockFetch(
        200,
        `<nowPlaying deviceID="${DEVICE_ID}" source="STANDBY">
          <ContentItem source="STANDBY" location="" sourceAccount="" isPresetable="false">
            <itemName></itemName>
          </ContentItem>
          <track>Test Track</track>
          <artist>Test Artist</artist>
          <album>Test Album</album>
          <stationName>Radio Station</stationName>
          <art artImageStatus="IMAGE_PRESENT">http://example.com/art.jpg</art>
          <playStatus>PLAY_STATE</playStatus>
          <description>Now playing description</description>
          <stationLocation>http://station.example.com</stationLocation>
        </nowPlaying>`,
      );
      const val = unwrapOk<NowPlayingResponse>(await client.getNowPlaying());
      expect(val.deviceID).toBe(DEVICE_ID);
      expect(val.track).toBe("Test Track");
      expect(val.artist).toBe("Test Artist");
      expect(val.album).toBe("Test Album");
      expect(val.stationName).toBe("Radio Station");
      expect(val.playStatus).toBe("PLAY_STATE");
    });
  });

  describe("/trackInfo", () => {
    it("parses trackInfo response", async () => {
      mockFetch(
        200,
        `<nowPlaying deviceID="${DEVICE_ID}" source="STANDBY">
          <ContentItem source="STANDBY" location="" sourceAccount="" isPresetable="false">
            <itemName></itemName>
          </ContentItem>
          <track>Info Track</track>
          <artist>Info Artist</artist>
          <album>Info Album</album>
          <stationName>Info Station</stationName>
          <art artImageStatus="SHOW_DEFAULT_IMAGE"></art>
          <playStatus>PAUSE_STATE</playStatus>
          <description></description>
          <stationLocation></stationLocation>
        </nowPlaying>`,
      );
      const val = unwrapOk<NowPlayingResponse>(await client.getTrackInfo());
      expect(val.track).toBe("Info Track");
      expect(val.playStatus).toBe("PAUSE_STATE");
    });
  });

  describe("/volume", () => {
    it("parses getVolume response", async () => {
      mockFetch(
        200,
        `<volume deviceID="${DEVICE_ID}">
          <targetvolume>42</targetvolume>
          <actualvolume>42</actualvolume>
          <muteenabled>false</muteenabled>
        </volume>`,
      );
      const val = unwrapOk<VolumeResponse>(await client.getVolume());
      expect(val.targetvolume).toBe(42);
      expect(val.actualvolume).toBe(42);
      expect(val.muteenabled).toBe(false);
    });

    it("sends setVolume POST with mute", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setVolume({
        volume: 50,
        muteEnabled: true,
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/volume`,
        expect.objectContaining({
          body: "<volume>50<muteenabled>true</muteenabled></volume>",
        }),
      );
    });

    it("sends setVolume POST without mute", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setVolume({ volume: 30 });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/volume`,
        expect.objectContaining({
          body: "<volume>30</volume>",
        }),
      );
    });
  });

  describe("/presets", () => {
    it("parses presets response", async () => {
      mockFetch(
        200,
        `<presets>
          <preset id="1" createdOn="1234567890" updatedOn="1234567899">
            <ContentItem source="TUNEIN" location="/v1/playback/station/s12345" sourceAccount="" isPresetable="true">
              <itemName>My Station</itemName>
            </ContentItem>
          </preset>
          <preset id="2">
            <ContentItem source="SPOTIFY" location="spotify:playlist:xxx" sourceAccount="user123" isPresetable="true">
              <itemName>My Playlist</itemName>
            </ContentItem>
          </preset>
        </presets>`,
      );
      const val = unwrapOk<PresetsResponse>(await client.getPresets());
      expect(val.presets).toHaveLength(2);
      expect(val.presets[0].id).toBe(1);
      expect(val.presets[0].id).toBe(1);
    });
  });

  describe("/info", () => {
    it("parses info response", async () => {
      mockFetch(
        200,
        `<info deviceID="${DEVICE_ID}">
          <name>Living Room</name>
          <type>SoundTouch 30</type>
          <margeAccountUUID>uuid-1234</margeAccountUUID>
          <components>
            <component>
              <componentCategory>SCM</componentCategory>
              <softwareVersion>27.0.1</softwareVersion>
              <serialNumber>SN123456</serialNumber>
            </component>
          </components>
          <margeURL>https://marge.example.com</margeURL>
          <networkInfo type="wifi">
            <macAddress>D05FB8A9591D</macAddress>
            <ipAddress>${IP}</ipAddress>
          </networkInfo>
        </info>`,
      );
      const val = unwrapOk<InfoResponse>(await client.getInfo());
      expect(val.name).toBe("Living Room");
      expect(val.type).toBe("SoundTouch 30");
      expect(val.components).toHaveLength(1);
      expect(val.components[0].componentCategory).toBe("SCM");
      expect(val.components[0].softwareVersion).toBe("27.0.1");
      expect(val.networkInfo.ipAddress).toBe(IP);
    });
  });

  describe("/name", () => {
    it("sends setName POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setName("New Name");
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/name`,
        expect.objectContaining({
          method: "POST",
          body: "<name>New Name</name>",
        }),
      );
    });

    it("escapes XML in name", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      await client.setName("Living & Dining <Room>");
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/name`,
        expect.objectContaining({
          body: "<name>Living &amp; Dining &lt;Room&gt;</name>",
        }),
      );
    });
  });

  describe("/capabilities", () => {
    it("parses capabilities response", async () => {
      mockFetch(
        200,
        `<capabilities deviceID="${DEVICE_ID}">
          <capability name="BASS" url="/bassCapabilities" info="Bass Capabilities"/>
          <capability name="VOLUME" url="/volume" info="Volume"/>
        </capabilities>`,
      );
      const val = unwrapOk<CapabilitiesResponse>(
        await client.getCapabilities(),
      );
      expect(val.capabilities).toHaveLength(2);
      expect(val.capabilities[0].name).toBe("BASS");
      expect(val.capabilities[0].url).toBe("/bassCapabilities");
    });
  });

  describe("/audiodspcontrols", () => {
    it("parses audioDspControls GET response", async () => {
      mockFetch(
        200,
        `<audiodspcontrols audiomode="AUDIO_MODE_NORMAL" videosyncaudiodelay="0" supportedaudiomodes="AUDIO_MODE_DIRECT|AUDIO_MODE_NORMAL|AUDIO_MODE_DIALOG"/>`,
      );
      const val = unwrapOk<{
        audiomode: string;
        supportedaudiomodes: string[];
      }>(await client.getAudioDspControls());
      expect(val.audiomode).toBe("AUDIO_MODE_NORMAL");
      expect(val.supportedaudiomodes).toEqual([
        "AUDIO_MODE_DIRECT",
        "AUDIO_MODE_NORMAL",
        "AUDIO_MODE_DIALOG",
      ]);
    });

    it("sends setAudioDspControls POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setAudioDspControls({
        audiomode: "AUDIO_MODE_DIALOG" as const,
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/audiodspcontrols`,
        expect.objectContaining({
          body: '<audiodspcontrols audiomode="AUDIO_MODE_DIALOG"/>',
        }),
      );
    });
  });

  describe("/audioproducttonecontrols", () => {
    it("parses audioProductToneControls GET response", async () => {
      mockFetch(
        200,
        `<audioproducttonecontrols>
          <bass value="5" minValue="-10" maxValue="10" step="1"/>
          <treble value="-3" minValue="-10" maxValue="10" step="1"/>
        </audioproducttonecontrols>`,
      );
      const val = unwrapOk<{
        bass: { value: number; minValue: number };
        treble: { value: number };
      }>(await client.getAudioProductToneControls());
      expect(val.bass.value).toBe(5);
      expect(val.bass.minValue).toBe(-10);
      expect(val.treble.value).toBe(-3);
    });

    it("sends setAudioProductToneControls POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setAudioProductToneControls({
        bass: { value: 3 },
        treble: { value: -2 },
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/audioproducttonecontrols`,
        expect.objectContaining({
          body: '<audioproducttonecontrols><bass value="3" /><treble value="-2" /></audioproducttonecontrols>',
        }),
      );
    });
  });

  describe("/audioproductlevelcontrols", () => {
    it("parses audioProductLevelControls GET response", async () => {
      mockFetch(
        200,
        `<audioproductlevelcontrols>
          <frontCenterSpeakerLevel value="0" minValue="-10" maxValue="10" step="1"/>
          <rearSurroundSpeakersLevel value="2" minValue="-10" maxValue="10" step="1"/>
        </audioproductlevelcontrols>`,
      );
      const val = unwrapOk<{
        frontCenterSpeakerLevel: { value: number };
        rearSurroundSpeakersLevel: { value: number };
      }>(await client.getAudioProductLevelControls());
      expect(val.frontCenterSpeakerLevel.value).toBe(0);
      expect(val.rearSurroundSpeakersLevel.value).toBe(2);
    });

    it("sends setAudioProductLevelControls POST", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.setAudioProductLevelControls({
        frontCenterSpeakerLevel: { value: 1 },
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/audioproductlevelcontrols`,
        expect.objectContaining({
          body: '<audioproductlevelcontrols><frontCenterSpeakerLevel value="1" /></audioproductlevelcontrols>',
        }),
      );
    });
  });

  describe("error handling", () => {
    it("returns NetworkError on fetch failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused"),
      );
      const result = await client.getVolume();
      expect(Result.isError(result)).toBe(true);
      const err = (result as { error: unknown }).error;
      expect(err).toBeInstanceOf(NetworkError);
    });

    it("returns HttpError on non-2xx response", async () => {
      mockFetch(500, "Internal Server Error");
      const result = await client.getVolume();
      expect(Result.isError(result)).toBe(true);
      const err = (result as { error: unknown }).error;
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(500);
    });

    it("returns ApiError on error response", async () => {
      mockFetch(
        400,
        `<errors deviceID="${DEVICE_ID}">
          <error value="1019" name="CLIENT_XML_ERROR" severity="Unknown">1019</error>
        </errors>`,
      );
      const result = await client.getVolume();
      expect(Result.isError(result)).toBe(true);
      const err = (result as { error: unknown }).error;
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).errors[0].name).toBe("CLIENT_XML_ERROR");
    });

    it("escapes XML special characters in pressKey", async () => {
      const fetchMock = mockFetch(200, "<status>OK</status>");
      const result = await client.pressKey({
        key: "PLAY" as const,
        state: "press" as const,
        sender: "test & <script>",
      });
      expect(Result.isOk(result)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}/key`,
        expect.objectContaining({
          body: '<key state="press" sender="test &amp; &lt;script&gt;">PLAY</key>',
        }),
      );
    });

    it("returns XmlParseError on malformed XML", async () => {
      mockFetch(200, "<volume><targetvolume>10</volume>");
      const result = await client.getVolume();
      expect(Result.isError(result)).toBe(true);
      expect((result as { error: unknown }).error).toBeInstanceOf(
        XmlParseError,
      );
    });

    it("handles non-numeric values gracefully", async () => {
      mockFetch(
        200,
        "<volume><targetvolume>not-a-number</targetvolume></volume>",
      );
      const result = await client.getVolume();
      expect(Result.isOk(result)).toBe(true);
      expect(
        (result as { value: { targetvolume: number } }).value.targetvolume,
      ).toBeNaN();
    });

    it("returns NetworkError on timeout", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError"),
      );
      const result = await client.getVolume();
      expect(Result.isError(result)).toBe(true);
      expect((result as { error: unknown }).error).toBeInstanceOf(NetworkError);
    });
  });
});
