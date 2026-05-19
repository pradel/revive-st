import { describe, expect, it } from "vitest";
import {
  parseInfoResponse,
  parseNowPlayingResponse,
  parseVolumeResponse,
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
});
