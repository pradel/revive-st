import { Result } from "better-result";
import { Linking } from "react-native";
import WifiManager from "react-native-wifi-reborn";

import {
  JoinRejected,
  JoinTimeout,
  ManualJoinNotConnected,
} from "../session/errors";
import type { Link, WifiPort } from "../session/ports";
import { currentNetwork, onNetworkChange } from "./network";

// iOS reports no link events; the link is assumed to stay up.
const noLinkEvents = () => undefined;
const staticLink: Link = {
  onLost: () => noLinkEvents,
  onRestored: () => noLinkEvents,
};

let joinedSsid: string | null = null;

export const iosWifi: WifiPort = {
  // iOS exposes no Wi-Fi state; the previous flow assumed it was on.
  // oxlint-disable-next-line typescript/require-await
  async isEnabled() {
    return true;
  },
  // iOS apps cannot scan for Wi-Fi networks.
  // oxlint-disable-next-line typescript/require-await
  async scan(signal) {
    signal.throwIfAborted();
    return { results: [], fresh: false };
  },
  currentNetwork,
  onNetworkChange,

  async join(target, signal) {
    signal.throwIfAborted();
    try {
      await WifiManager.connectToProtectedSSIDPrefix(target.ssid, "", false);
    } catch (error) {
      signal.throwIfAborted();
      const timedOut =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "timeoutOccurred";
      return Result.err(
        timedOut
          ? new JoinTimeout({ ssid: target.ssid })
          : new JoinRejected({ ssid: target.ssid }),
      );
    }
    joinedSsid = target.ssid;
    if (signal.aborted) {
      await iosWifi.release();
      signal.throwIfAborted();
    }
    return Result.ok(staticLink);
  },

  // oxlint-disable-next-line typescript/require-await
  async bindToConnectedWifi() {
    return Result.err(new ManualJoinNotConnected());
  },

  async release() {
    const ssid = joinedSsid;
    joinedSsid = null;
    if (ssid === null) {
      return;
    }
    try {
      await WifiManager.disconnectFromSSID(ssid);
    } catch {
      // Best effort: iOS reconnects to the home network by itself.
    }
  },
  async openWifiPanel() {
    await Linking.openSettings();
  },
  async openWifiSettings() {
    await Linking.openSettings();
  },
};
