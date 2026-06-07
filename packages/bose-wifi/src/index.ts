import BoseWifiModule from "./BoseWifiModule";

export type BoseConnectionResult = Awaited<
  ReturnType<typeof BoseWifiModule.connectToOpenNetwork>
>;

export async function connectToOpenNetwork(
  ssid: string,
  bssid: string,
): Promise<BoseConnectionResult> {
  return BoseWifiModule.connectToOpenNetwork(ssid, bssid);
}

export async function disconnect(): Promise<null> {
  return BoseWifiModule.disconnect();
}

export async function isConnected(): Promise<boolean> {
  return BoseWifiModule.isConnected();
}

export async function openWifiSettings(): Promise<null> {
  return BoseWifiModule.openWifiSettings();
}

export async function openWifiSettingsPanel(): Promise<null> {
  return BoseWifiModule.openWifiSettingsPanel();
}
