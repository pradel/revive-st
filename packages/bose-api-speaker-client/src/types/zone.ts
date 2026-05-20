export interface ZoneMember {
  ipaddress: string;
  macAddress: string;
}

export interface ZoneResponse {
  master: string;
  members: ZoneMember[];
}

export interface SetZoneRequest {
  master: string;
  senderIpAddress: string;
  members: ZoneMember[];
}
