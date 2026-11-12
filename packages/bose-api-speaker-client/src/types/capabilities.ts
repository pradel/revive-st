export interface Capability {
  name: string;
  url: string;
  info: string;
}

export interface CapabilitiesResponse {
  deviceID: string;
  capabilities: Capability[];
  /**
   * Whether the speaker can be half of a stereo pair (true on a SoundTouch
   * 10); unset when the speaker doesn't say.
   */
  lrStereoCapable?: boolean;
}
