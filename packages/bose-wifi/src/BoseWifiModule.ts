import { type NativeModule, requireNativeModule } from "expo";

export type LinkEvent = "onLinkLost" | "onLinkRestored";

export type BoseWifiModuleEvents = Record<LinkEvent, () => void>;

declare class BoseWifiModule extends NativeModule<BoseWifiModuleEvents> {
  join(ssid: string, bssid: string, timeoutMs: number): Promise<null>;
  release(): Promise<null>;
  bindToConnectedWifi(): Promise<boolean>;
  openWifiPanel(): Promise<null>;
  openWifiSettings(): Promise<null>;
}

export default requireNativeModule<BoseWifiModule>("BoseWifi");
