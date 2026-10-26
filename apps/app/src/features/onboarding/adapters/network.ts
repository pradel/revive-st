import * as Network from "expo-network";
import WifiManager from "react-native-wifi-reborn";

import type { NetworkState } from "../session/ports";

async function currentSsid(): Promise<string | null> {
  try {
    const ssid = await WifiManager.getCurrentWifiSSID();
    // Android reports "<unknown ssid>" when it cannot read the SSID.
    return ssid && ssid !== "<unknown ssid>" ? ssid : null;
  } catch {
    return null;
  }
}

async function toNetworkState(
  state: Network.NetworkState,
): Promise<NetworkState> {
  if (!state.isConnected) {
    return { transport: "none", ssid: null };
  }
  switch (state.type) {
    case Network.NetworkStateType.WIFI:
      return { transport: "wifi", ssid: await currentSsid() };
    case Network.NetworkStateType.CELLULAR:
      return { transport: "cellular", ssid: null };
    default:
      return { transport: "none", ssid: null };
  }
}

export async function currentNetwork(): Promise<NetworkState> {
  return toNetworkState(await Network.getNetworkStateAsync());
}

export function onNetworkChange(cb: (s: NetworkState) => void): () => void {
  let latest = 0;
  let active = true;
  const subscription = Network.addNetworkStateListener((event) => {
    // The SSID lookup is async: drop results overtaken by a newer event.
    const seq = ++latest;
    void toNetworkState(event).then((state) => {
      if (active && seq === latest) {
        cb(state);
      }
    });
  });
  return () => {
    active = false;
    subscription.remove();
  };
}
