import { NativeModule, requireNativeModule } from "expo";

declare class BoseWifiModule extends NativeModule {
  connectToOpenNetwork(ssid: string, bssid: string): Promise<string>;
  disconnect(): Promise<string>;
}

export default requireNativeModule<BoseWifiModule>("BoseWifi");
