export interface DeviceComponent {
  componentCategory: string;
  softwareVersion: string;
  serialNumber: string;
}

export interface DeviceNetworkInfo {
  type: string;
  macAddress: string;
  ipAddress: string;
}

export interface InfoResponse {
  deviceID: string;
  name: string;
  type: string;
  margeAccountUUID: string;
  components: DeviceComponent[];
  margeURL: string;
  networkInfo: DeviceNetworkInfo;
}
