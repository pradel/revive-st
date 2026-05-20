export interface BassCapabilitiesResponse {
  deviceID: string;
  bassAvailable: boolean;
  bassMin: number;
  bassMax: number;
  bassDefault: number;
}

export interface BassResponse {
  deviceID: string;
  targetbass: number;
  actualbass: number;
}
