import { NativeModule, requireNativeModule } from "expo";

export interface BoseConnectionResult {
  success: boolean;
  ip: string;
  telnetPort: number;
  apiPort: number;
  message: string;
}

declare class BoseWifiModule extends NativeModule {
  connectToOpenNetwork(
    ssid: string,
    bssid?: string,
  ): Promise<BoseConnectionResult>;
  disconnect(): Promise<null>;
  isConnected(): Promise<boolean>;
  openWifiSettings(): Promise<null>;
}

export default requireNativeModule<BoseWifiModule>("BoseWifi");
