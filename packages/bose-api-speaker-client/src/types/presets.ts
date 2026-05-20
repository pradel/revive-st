import type { ContentItem } from "./nowPlaying.ts";

export interface Preset {
  id: number;
  createdOn?: number;
  updatedOn?: number;
  contentItem: ContentItem;
}

export interface PresetsResponse {
  presets: Preset[];
}
