import { Result } from "better-result";
import * as BoseWifi from "expo-bose-wifi";
import WifiManager, { type WifiEntry } from "react-native-wifi-reborn";

import { logger } from "@/lib/logger";

import {
  JoinRejected,
  JoinTimeout,
  ManualJoinNotConnected,
} from "../session/errors";
import type { Link, ScanResult, WifiPort } from "../session/ports";
import { currentNetwork, onNetworkChange } from "./network";

/**
 * Backstop for the native `requestNetwork`; the session aborts the join at its own
 * `JOIN_TIMEOUT_MS` (same value). Native expiry surfaces as `JOIN_UNAVAILABLE`, like a
 * cancelled approval dialog, so the elapsed time tells them apart.
 */
const NATIVE_JOIN_TIMEOUT_MS = 90_000;
const TIMEOUT_SLACK_MS = 1_000;

async function loadScan(): Promise<{ entries: WifiEntry[]; fresh: boolean }> {
  try {
    const fresh: unknown = await WifiManager.reScanAndLoadWifiList();
    // Throttled scans resolve with a string instead of a list.
    if (Array.isArray(fresh)) {
      return { entries: fresh as WifiEntry[], fresh: true };
    }
  } catch {
    // Throttled or rejected: fall back to the cached results.
  }
  try {
    const cached: unknown = await WifiManager.loadWifiList();
    return {
      entries: Array.isArray(cached) ? (cached as WifiEntry[]) : [],
      fresh: false,
    };
  } catch {
    return { entries: [], fresh: false };
  }
}

async function scanWifi(
  signal: AbortSignal,
): Promise<{ results: ScanResult[]; fresh: boolean }> {
  const { entries, fresh } = await loadScan();
  signal.throwIfAborted();
  const results = entries.map((entry) => ({
    ssid: entry.SSID,
    bssid: entry.BSSID,
    frequencyMHz: entry.frequency,
    level: entry.level,
    capabilities: entry.capabilities,
  }));
  return { results, fresh };
}

function nativeLink(): Link {
  return {
    onLost: (cb) => {
      const subscription = BoseWifi.addLinkListener("onLinkLost", cb);
      return () => {
        subscription.remove();
      };
    },
    onRestored: (cb) => {
      const subscription = BoseWifi.addLinkListener("onLinkRestored", cb);
      return () => {
        subscription.remove();
      };
    },
  };
}

export const androidWifi: WifiPort = {
  async isEnabled() {
    return WifiManager.isEnabled();
  },
  scan: scanWifi,
  currentNetwork,
  onNetworkChange,

  async join(target, signal) {
    signal.throwIfAborted();
    // Rejects the pending native join with JOIN_RELEASED and unbinds.
    const onAbort = () => {
      void BoseWifi.release();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const startedAt = Date.now();
    try {
      await BoseWifi.join(target.ssid, target.bssid, NATIVE_JOIN_TIMEOUT_MS);
      signal.throwIfAborted();
      return Result.ok(nativeLink());
    } catch (error) {
      // Aborted (JOIN_RELEASED, or settled after the abort): reject with the abort reason.
      signal.throwIfAborted();
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "UNKNOWN";
      const elapsed = Date.now() - startedAt;
      logger.log(`[Wifi] join failed: ${code} after ${elapsed} ms`);
      if (
        code === "JOIN_UNAVAILABLE" &&
        elapsed >= NATIVE_JOIN_TIMEOUT_MS - TIMEOUT_SLACK_MS
      ) {
        return Result.err(new JoinTimeout({ ssid: target.ssid }));
      }
      return Result.err(new JoinRejected({ ssid: target.ssid }));
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  },

  async bindToConnectedWifi() {
    const bound = await BoseWifi.bindToConnectedWifi().catch(() => false);
    return bound
      ? Result.ok(nativeLink())
      : Result.err(new ManualJoinNotConnected());
  },

  async release() {
    await BoseWifi.release();
  },
  async openWifiPanel() {
    await BoseWifi.openWifiPanel();
  },
  async openWifiSettings() {
    await BoseWifi.openWifiSettings();
  },
};
