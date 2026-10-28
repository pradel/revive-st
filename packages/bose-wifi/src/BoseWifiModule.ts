import { type NativeModule, requireOptionalNativeModule } from "expo";

export type LinkEvent = "onLinkLost" | "onLinkRestored";

export type BoseWifiModuleEvents = Record<LinkEvent, () => void>;

declare class BoseWifiModule extends NativeModule<BoseWifiModuleEvents> {
  join(ssid: string, bssid: string, timeoutMs: number): Promise<null>;
  release(): Promise<null>;
  bindToConnectedWifi(): Promise<boolean>;
  openWifiPanel(): Promise<null>;
  openWifiSettings(): Promise<null>;
}

/** Android only: `null` elsewhere (iOS), so importing the package never crashes. */
const nativeModule = requireOptionalNativeModule<BoseWifiModule>("BoseWifi");

/** The native module; throws when it is not available on this platform. */
export function boseWifiModule(): BoseWifiModule {
  if (!nativeModule) {
    throw new Error(
      "expo-bose-wifi: the BoseWifi native module is not available (Android only)",
    );
  }
  return nativeModule;
}
