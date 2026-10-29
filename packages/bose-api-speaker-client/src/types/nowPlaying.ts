import type { ArtImageStatus, PlayStatus } from "./common.ts";

export interface ContentItem {
  source: string;
  /** `stationurl`, `tracklisturl`, …; empty when the speaker omits it. */
  type: string;
  location: string;
  sourceAccount: string;
  isPresetable: boolean;
  itemName: string;
  /** Artwork URL; empty when the speaker has none. */
  containerArt: string;
}

export interface NowPlayingResponse {
  deviceID: string;
  source: string;
  contentItem: ContentItem;
  track: string;
  artist: string;
  album: string;
  stationName: string;
  art: {
    artImageStatus: ArtImageStatus;
    url: string;
  };
  playStatus: PlayStatus;
  description: string;
  stationLocation: string;
}
