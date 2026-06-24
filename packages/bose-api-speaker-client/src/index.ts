import { BoseHttpAdapter } from "./http-adapter.ts";
export { Speaker } from "./speaker.ts";
export type { SpeakerOptions, SpeakerState } from "./speaker.ts";

export function boseSpeakerClient(opts: {
  ip: string;
  port?: number;
}): BoseHttpAdapter {
  return new BoseHttpAdapter(opts);
}

export type { BoseHttpAdapter as BoseSpeakerClient } from "./http-adapter.ts";
export { BoseHttpAdapter } from "./http-adapter.ts";
export { escapeXml } from "./http-adapter.ts";
export { parseXml } from "./xml-parser.ts";
export type { XmlNode } from "./xml-parser.ts";

export { BoseWebSocketClient } from "./ws-adapter.ts";
export {
  TelnetClient,
  TelnetConnectionError,
  TelnetCommandError,
} from "./telnet.ts";
export type {
  BoseWebSocketClientOptions,
  BoseWSUpdate,
  BoseConnectionState,
} from "./ws-adapter.ts";
export type {
  TcpSocketLike,
  SocketModuleLike,
  TelnetClientOptions,
} from "./telnet.ts";

export type { BoseApiError } from "./errors.ts";
export { ApiError, HttpError, NetworkError, XmlParseError } from "./errors.ts";

export type {
  AudioDspControlsResponse,
  AudioMode,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  ArtImageStatus,
  BassCapabilitiesResponse,
  BassResponse,
  CapabilitiesResponse,
  Capability,
  ContentItem,
  DeviceComponent,
  DeviceNetworkInfo,
  InfoResponse,
  KeyPressRequest,
  KeyState,
  KeyValue,
  LevelControl,
  NowPlayingResponse,
  PlayStatus,
  Preset,
  PresetsResponse,
  SelectSourceRequest,
  SetAudioDspControlsRequest,
  SetLevelControlsRequest,
  SetToneControlsRequest,
  SetVolumeRequest,
  SetZoneRequest,
  SourceItem,
  SourceStatus,
  SourcesResponse,
  ToneControl,
  VolumeResponse,
  ZoneMember,
  ZoneResponse,
} from "./types/index.ts";
