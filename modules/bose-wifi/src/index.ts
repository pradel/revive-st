import BoseWifiModule from "./BoseWifiModule";

export type BoseConnectionResult = Awaited<ReturnType<typeof BoseWifiModule.connectToOpenNetwork>>;

export function connectToOpenNetwork(ssid: string, bssid: string): Promise<BoseConnectionResult> {
  return BoseWifiModule.connectToOpenNetwork(ssid, bssid);
}

export function disconnect(): Promise<null> {
  return BoseWifiModule.disconnect();
}

export function isConnected(): Promise<boolean> {
  return BoseWifiModule.isConnected();
}

export function openWifiSettings(): Promise<null> {
  return BoseWifiModule.openWifiSettings();
}
