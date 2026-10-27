export interface NetworkInterfaceInfo {
  name: string;
  type?: string;
  macAddress?: string;
  ipAddress?: string;
  ssid?: string;
  frequencyKHz?: number;
  state?: string;
  mode?: string;
  signal?: string;
}

export interface NetworkInfoResponse {
  wifiProfileCount?: number;
  interfaces: NetworkInterfaceInfo[];
}
