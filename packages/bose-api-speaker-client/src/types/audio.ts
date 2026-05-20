import type { AudioMode } from "./common.ts";

export interface AudioDspControlsResponse {
  audiomode: AudioMode;
  videosyncaudiodelay: number;
  supportedaudiomodes: AudioMode[];
}

export interface SetAudioDspControlsRequest {
  audiomode?: AudioMode;
  videosyncaudiodelay?: number;
}

export interface ToneControl {
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
}

export interface AudioProductToneControlsResponse {
  bass: ToneControl;
  treble: ToneControl;
}

export interface SetToneControlsRequest {
  bass?: { value: number };
  treble?: { value: number };
}

export interface LevelControl {
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
}

export interface AudioProductLevelControlsResponse {
  frontCenterSpeakerLevel: LevelControl;
  rearSurroundSpeakersLevel: LevelControl;
}

export interface SetLevelControlsRequest {
  frontCenterSpeakerLevel?: { value: number };
  rearSurroundSpeakersLevel?: { value: number };
}
