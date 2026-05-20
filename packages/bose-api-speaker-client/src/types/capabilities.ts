export interface Capability {
  name: string;
  url: string;
  info: string;
}

export interface CapabilitiesResponse {
  deviceID: string;
  capabilities: Capability[];
}
