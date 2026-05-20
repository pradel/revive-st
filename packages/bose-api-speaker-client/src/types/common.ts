export const KeyValue = {
  PLAY: "PLAY",
  PAUSE: "PAUSE",
  STOP: "STOP",
  PREV_TRACK: "PREV_TRACK",
  NEXT_TRACK: "NEXT_TRACK",
  THUMBS_UP: "THUMBS_UP",
  THUMBS_DOWN: "THUMBS_DOWN",
  BOOKMARK: "BOOKMARK",
  POWER: "POWER",
  MUTE: "MUTE",
  VOLUME_UP: "VOLUME_UP",
  VOLUME_DOWN: "VOLUME_DOWN",
  PRESET_1: "PRESET_1",
  PRESET_2: "PRESET_2",
  PRESET_3: "PRESET_3",
  PRESET_4: "PRESET_4",
  PRESET_5: "PRESET_5",
  PRESET_6: "PRESET_6",
  AUX_INPUT: "AUX_INPUT",
  SHUFFLE_OFF: "SHUFFLE_OFF",
  SHUFFLE_ON: "SHUFFLE_ON",
  REPEAT_OFF: "REPEAT_OFF",
  REPEAT_ONE: "REPEAT_ONE",
  REPEAT_ALL: "REPEAT_ALL",
  PLAY_PAUSE: "PLAY_PAUSE",
  ADD_FAVORITE: "ADD_FAVORITE",
  REMOVE_FAVORITE: "REMOVE_FAVORITE",
} as const;

export type KeyValue = (typeof KeyValue)[keyof typeof KeyValue];

export const KeyState = {
  PRESS: "press",
  RELEASE: "release",
} as const;

export type KeyState = (typeof KeyState)[keyof typeof KeyState];

export const PlayStatus = {
  PLAY_STATE: "PLAY_STATE",
  PAUSE_STATE: "PAUSE_STATE",
  STOP_STATE: "STOP_STATE",
  BUFFERING_STATE: "BUFFERING_STATE",
  INVALID_PLAY_STATUS: "INVALID_PLAY_STATUS",
} as const;

export type PlayStatus = (typeof PlayStatus)[keyof typeof PlayStatus];

export const SourceStatus = {
  UNAVAILABLE: "UNAVAILABLE",
  READY: "READY",
} as const;

export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

export const AudioMode = {
  AUDIO_MODE_DIRECT: "AUDIO_MODE_DIRECT",
  AUDIO_MODE_NORMAL: "AUDIO_MODE_NORMAL",
  AUDIO_MODE_DIALOG: "AUDIO_MODE_DIALOG",
  AUDIO_MODE_NIGHT: "AUDIO_MODE_NIGHT",
} as const;

export type AudioMode = (typeof AudioMode)[keyof typeof AudioMode];

export const ArtImageStatus = {
  INVALID: "INVALID",
  SHOW_DEFAULT_IMAGE: "SHOW_DEFAULT_IMAGE",
  DOWNLOADING: "DOWNLOADING",
  IMAGE_PRESENT: "IMAGE_PRESENT",
} as const;

export type ArtImageStatus =
  (typeof ArtImageStatus)[keyof typeof ArtImageStatus];
