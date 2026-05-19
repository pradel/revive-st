import BoseWifiModule from "./BoseWifiModule";

export function connectToOpenNetwork(
  ssid: string,
  bssid: string,
): Promise<string> {
  return BoseWifiModule.connectToOpenNetwork(ssid, bssid);
}

export function disconnect(): Promise<string> {
  return BoseWifiModule.disconnect();
}
