import type { Result } from "better-result";

import type {
  JoinRejected,
  JoinTimeout,
  ManualJoinNotConnected,
  SpeakerError,
} from "./errors";

/** One access point from a Wi-Fi scan. `level` is the RSSI in dBm. */
export interface ScanResult {
  ssid: string;
  bssid: string;
  frequencyMHz: number;
  level: number;
  capabilities: string;
}

export interface NetworkState {
  transport: "wifi" | "cellular" | "none";
  ssid: string | null;
}

/** The process binding to the setup network. Listeners return an unsubscribe function. */
export interface Link {
  onLost: (cb: () => void) => () => void;
  onRestored: (cb: () => void) => () => void;
}

export interface WifiPort {
  isEnabled: () => Promise<boolean>;
  /** Never throws on throttle: returns cached results with `fresh: false`. */
  scan: (
    signal: AbortSignal,
  ) => Promise<{ results: ScanResult[]; fresh: boolean }>;
  currentNetwork: () => Promise<NetworkState>;
  onNetworkChange: (cb: (s: NetworkState) => void) => () => void;
  join: (
    target: { ssid: string; bssid: string },
    signal: AbortSignal,
  ) => Promise<Result<Link, JoinRejected | JoinTimeout>>;
  bindToConnectedWifi: () => Promise<Result<Link, ManualJoinNotConnected>>;
  /** Idempotent, never throws. */
  release: () => Promise<void>;
  openWifiPanel: () => Promise<void>;
  openWifiSettings: () => Promise<void>;
}

export interface SpeakerInfo {
  deviceID: string;
  name: string;
  type: string;
}

export interface SpeakerInterface {
  name: string;
  ipAddress?: string;
  ssid?: string;
  state?: string;
  mode?: string;
  frequencyKHz?: number;
}

/** An empty password means an open network. */
export interface Credentials {
  ssid: string;
  password: string;
}

/** Speaker HTTP API on port 8090. Never rejects: aborts surface as `SpeakerTransportError`. */
export interface SpeakerHttp {
  info: (
    ip: string,
    signal: AbortSignal,
  ) => Promise<Result<SpeakerInfo, SpeakerError>>;
  sendCredentials: (
    ip: string,
    credentials: Credentials,
    signal: AbortSignal,
  ) => Promise<Result<void, SpeakerError>>;
  networkInfo: (
    ip: string,
    signal: AbortSignal,
  ) => Promise<Result<{ interfaces: SpeakerInterface[] }, SpeakerError>>;
  setupState: (
    ip: string,
    signal: AbortSignal,
  ) => Promise<Result<{ state: string }, SpeakerError>>;
  /** POST /setup `<setupState state="SETUP_LEAVE"/>`. */
  leaveSetup: (
    ip: string,
    signal: AbortSignal,
  ) => Promise<Result<void, SpeakerError>>;
}

/** A resolved `_soundtouch._tcp` service. `mac` is the TXT `MAC` record (upper-case, no separators). */
export interface DiscoveredService {
  host: string;
  port: number;
  mac: string | null;
}

export interface Discovery {
  /** Yields resolved services until aborted; the implementation restarts the browse every `BROWSE_RESTART_MS`. */
  browse: (signal: AbortSignal) => AsyncIterable<DiscoveredService>;
}

export interface Permissions {
  location: (
    request: boolean,
  ) => Promise<{ granted: boolean; fine: boolean; canAskAgain: boolean }>;
  locationServicesEnabled: () => Promise<boolean>;
  openAppSettings: () => Promise<void>;
  openLocationSettings: () => Promise<void>;
}

export interface Clock {
  now: () => number;
  /** Resolves after `ms`; rejects as soon as `signal` aborts. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}

export interface Log {
  event: (
    name: string,
    data?: Record<string, string | number | boolean>,
  ) => void;
}

export interface SetupDeps {
  wifi: WifiPort;
  speaker: SpeakerHttp;
  discovery: Discovery;
  permissions: Permissions;
  clock: Clock;
  log: Log;
}
