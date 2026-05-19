import { describe, expect, it, vi, afterEach } from "vitest";
import {
  parseInfoResponse,
  parseNowPlayingResponse,
  parseVolumeResponse,
  parsePresetsResponse,
  parseBassResponse,
  playSpeakerUri,
} from "./boseParser";

describe("boseParser", () => {
  describe("parseInfoResponse", () => {
    it("parses valid info xml successfully", () => {
      const xml = `
        <info deviceID="000C8A123456">
          <name>Living Room &amp; Kitchen</name>
          <type>SoundTouch 20</type>
          <networkInfo type="WIFI">
            <macAddress>000C8A123456</macAddress>
            <ipAddress>192.168.1.105</ipAddress>
          </networkInfo>
        </info>
      `;
      const result = parseInfoResponse(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        name: "Living Room & Kitchen",
        type: "SoundTouch 20",
        ipAddress: "192.168.1.105",
      });
    });

    it("handles missing elements gracefully", () => {
      const xml = `<info deviceID="000C8A123456"></info>`;
      const result = parseInfoResponse(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        name: "Bose Speaker",
        type: "SoundTouch",
        ipAddress: "",
      });
    });
  });

  describe("parseNowPlayingResponse", () => {
    it("parses standby nowPlaying xml", () => {
      const xml = `
        <nowPlaying deviceID="000C8A123456" source="STANDBY">
          <ContentItem source="STANDBY" location="" sourceAccount="" isPresetable="false">
            <itemName>Standby</itemName>
          </ContentItem>
          <playStatus>STANDBY</playStatus>
        </nowPlaying>
      `;
      const result = parseNowPlayingResponse(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        source: "STANDBY",
        playStatus: "STANDBY",
        track: undefined,
        artist: undefined,
        album: undefined,
        artUrl: undefined,
      });
    });

    it("parses active playing xml with track info and album art", () => {
      const xml = `
        <nowPlaying deviceID="000C8A123456" source="SPOTIFY">
          <ContentItem source="SPOTIFY" location="spotify:playlist:123" sourceAccount="user@spotify" isPresetable="true">
            <itemName>My Playlist</itemName>
          </ContentItem>
          <track>Get Lucky (feat. Pharrell Williams)</track>
          <artist>Daft Punk &amp; Pharrell</artist>
          <album>Random Access Memories</album>
          <art artImageStatus="IMAGE_PRESENT">http://example.com/art.jpg</art>
          <playStatus>PLAY_STATE</playStatus>
        </nowPlaying>
      `;
      const result = parseNowPlayingResponse(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        source: "SPOTIFY",
        playStatus: "PLAY_STATE",
        track: "Get Lucky (feat. Pharrell Williams)",
        artist: "Daft Punk & Pharrell",
        album: "Random Access Memories",
        artUrl: "http://example.com/art.jpg",
      });
    });
  });

  describe("parseVolumeResponse", () => {
    it("parses valid volume xml", () => {
      const xml = `
        <volume deviceID="000C8A123456">
          <targetvolume>45</targetvolume>
          <actualvolume>42</actualvolume>
          <muteenabled>false</muteenabled>
        </volume>
      `;
      const result = parseVolumeResponse(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        targetVolume: 45,
        actualVolume: 42,
        muteEnabled: false,
      });
    });

    it("parses muted volume xml", () => {
      const xml = `
        <volume deviceID="000C8A123456">
          <targetvolume>15</targetvolume>
          <actualvolume>15</actualvolume>
          <muteenabled>true</muteenabled>
        </volume>
      `;
      const result = parseVolumeResponse(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        targetVolume: 15,
        actualVolume: 15,
        muteEnabled: true,
      });
    });
  });

  describe("parsePresetsResponse", () => {
    it("parses empty presets successfully", () => {
      const xml = `<presets></presets>`;
      const result = parsePresetsResponse(xml);
      expect(result).toEqual([]);
    });

    it("parses valid presets successfully", () => {
      const xml = `
        <presets>
          <preset id="1" createdOn="1463123456" updateOn="1463999999">
            <ContentItem source="SPOTIFY" location="spotify:playlist:abc" sourceAccount="user@spotify" isPresetable="true">
              <itemName>Rock Mix</itemName>
            </ContentItem>
          </preset>
          <preset id="2" createdOn="1463123456" updateOn="1463999999">
            <ContentItem source="INTERNET_RADIO" location="http://stream.url" sourceAccount="" isPresetable="true">
              <itemName>BBC Radio 1</itemName>
            </ContentItem>
          </preset>
        </presets>
      `;
      const result = parsePresetsResponse(xml);
      expect(result).toEqual([
        {
          id: "1",
          name: "Rock Mix",
          source: "SPOTIFY",
          sourceAccount: "user@spotify",
          location: "spotify:playlist:abc",
        },
        {
          id: "2",
          name: "BBC Radio 1",
          source: "INTERNET_RADIO",
          sourceAccount: undefined,
          location: "http://stream.url",
        },
      ]);
    });
  });

  describe("parseBassResponse", () => {
    it("parses valid bass response successfully", () => {
      const xml = `
        <bass deviceID="000C8A123456">
          <targetbass>-4</targetbass>
          <actualbass>-4</actualbass>
        </bass>
      `;
      const result = parseBassResponse(xml);
      expect(result).toEqual({
        targetBass: -4,
        actualBass: -4,
      });
    });
  });

  describe("playSpeakerUri", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("sends correct XML payload for custom streams", async () => {
      let capturedUrl = "";
      let capturedOptions: any = null;

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("<status>ok</status>"),
        });
      }) as any;

      await playSpeakerUri(
        "192.168.1.100",
        "http://stream.url?a=1&b=2",
        "Station & Co",
      );

      expect(capturedUrl).toBe("http://192.168.1.100:8090/select");
      expect(capturedOptions.method).toBe("POST");
      expect(capturedOptions.headers["Content-Type"]).toBe("text/xml");
      expect(capturedOptions.body).toContain('source="INTERNET_RADIO"');
      expect(capturedOptions.body).toContain(
        'location="http://stream.url?a=1&amp;b=2"',
      );
      expect(capturedOptions.body).toContain(
        "<itemName>Station &amp; Co</itemName>",
      );
    });
  });
});
