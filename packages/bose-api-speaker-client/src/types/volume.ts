export interface VolumeResponse {
  deviceID: string;
  targetvolume: number;
  actualvolume: number;
  muteenabled: boolean;
}

export interface SetVolumeRequest {
  volume: number;
  muteEnabled?: boolean;
}
