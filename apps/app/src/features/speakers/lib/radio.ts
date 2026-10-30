import { escapeXml } from "bose-api-speaker-client";

/** The Radio Browser station fields a speaker needs to play it. */
export interface CastStation {
  readonly stationuuid: string;
  readonly name: string;
  readonly favicon: string;
}

/**
 * The ContentItem that plays a Radio Browser station. Its location names the
 * station, not its stream: the server's Radio Browser adapter looks the
 * stream up every time it plays, so a preset follows the station when it
 * moves its stream. The location holds no server address either, so it plays
 * through whichever Revive ST server the speaker uses.
 */
export const buildRadioBrowserPayload = (station: CastStation): string =>
  `<ContentItem source="RADIO_BROWSER" type="stationurl" location="/stations/byuuid/${escapeXml(
    station.stationuuid,
  )}" sourceAccount="" isPresetable="true"><itemName>${escapeXml(
    station.name,
  )}</itemName><containerArt>${escapeXml(station.favicon)}</containerArt></ContentItem>`;
