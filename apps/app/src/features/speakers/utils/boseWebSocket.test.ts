import { describe, expect, it } from "vitest";
import { parseWebSocketMessage } from "./boseWebSocket";

describe("boseWebSocket", () => {
  describe("parseWebSocketMessage", () => {
    it("returns null if XML doesn't contain updates element with deviceID", () => {
      const xml = `<invalidXml />`;
      expect(parseWebSocketMessage(xml)).toBeNull();
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
      const result = parseWebSocketMessage(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        type: "volume",
        volume: {
          deviceID: "000C8A123456",
          targetVolume: 50,
          actualVolume: 45,
          muteEnabled: false,
        },
        nowPlaying: undefined,
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
      const result = parseWebSocketMessage(xml);
      expect(result).toEqual({
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
        volume: undefined,
      });
    });

    it("identifies basic signal volume updates with no payload", () => {
      const xml = `
        <updates deviceID="000C8A123456">
          <volumeUpdated />
        </updates>
      `;
      const result = parseWebSocketMessage(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        type: "volume",
        volume: undefined,
        nowPlaying: undefined,
      });
    });

    it("identifies basic signal nowPlaying updates with no payload", () => {
      const xml = `
        <updates deviceID="000C8A123456">
          <nowPlayingUpdated />
        </updates>
      `;
      const result = parseWebSocketMessage(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        type: "nowPlaying",
        volume: undefined,
        nowPlaying: undefined,
      });
    });

    it("parses presets updates correctly", () => {
      const xml = `
        <updates deviceID="000C8A123456">
          <presetsUpdated />
        </updates>
      `;
      const result = parseWebSocketMessage(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        type: "presets",
        volume: undefined,
        nowPlaying: undefined,
      });
    });

    it("parses zone updates correctly", () => {
      const xml = `
        <updates deviceID="000C8A123456">
          <zoneUpdated />
        </updates>
      `;
      const result = parseWebSocketMessage(xml);
      expect(result).toEqual({
        deviceID: "000C8A123456",
        type: "zone",
        volume: undefined,
        nowPlaying: undefined,
      });
    });
  });
});
