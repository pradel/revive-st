// Fakes implement async ports with synchronous state.
// oxlint-disable typescript/require-await
import { Result } from "better-result";

import { AbortedError } from "../async";
import {
  JoinRejected,
  ManualJoinNotConnected,
  type SpeakerError,
  SpeakerApiError,
  SpeakerResponseError,
  SpeakerTransportError,
} from "../errors";
import type {
  Clock,
  Credentials,
  DiscoveredService,
  Discovery,
  Link,
  Log,
  NetworkState,
  Permissions,
  ScanResult,
  SetupDeps,
  SpeakerHttp,
  SpeakerInfo,
  SpeakerInterface,
  WifiPort,
} from "../ports";
import { SETUP_IP } from "../steps/env";

// ---------------------------------------------------------------------------
// Clock and log

/** A `Clock` that can also run callbacks later (the fakes' own behaviour). */
export interface SchedulingClock extends Clock {
  /** Runs `fire` after `ms`; returns a function that cancels it. */
  schedule: (ms: number, fire: () => void) => () => void;
}

interface Timer {
  id: number;
  at: number;
  fire: () => void;
}

/** Waits until every queued promise callback has run (no timers involved). */
export async function flushPromises(): Promise<void> {
  for (let round = 0; round < 2; round++) {
    // A macrotask turn: every queued promise callback runs before it.
    await new Promise<void>((resolve) => {
      globalThis.setImmediate(resolve);
    });
  }
}

/** Virtual time: nothing happens until a test advances it. */
export class ManualClock implements SchedulingClock {
  #now: number;
  #timers: Timer[] = [];
  #nextId = 0;

  constructor(start = 1_000_000) {
    this.#now = start;
  }

  now(): number {
    return this.#now;
  }

  async sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new AbortedError());
        return;
      }
      const onAbort = () => {
        cancel();
        reject(new AbortedError());
      };
      const cancel = this.schedule(ms, () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      });
      signal.addEventListener("abort", onAbort);
    });
  }

  schedule(ms: number, fire: () => void): () => void {
    const timer = { id: this.#nextId++, at: this.#now + Math.max(0, ms), fire };
    this.#timers.push(timer);
    return () => {
      this.#timers = this.#timers.filter((entry) => entry !== timer);
    };
  }

  /** Timers not yet fired or cancelled (sleeps and fake behaviour). */
  get pendingTimers(): number {
    return this.#timers.length;
  }

  /** Fires every timer due within `ms`, in order, letting promises settle in between. */
  async advance(ms: number): Promise<void> {
    const target = this.#now + ms;
    await flushPromises();
    for (;;) {
      const timer = this.#earliest();
      if (!timer || timer.at > target) {
        break;
      }
      await this.#fire(timer);
    }
    this.#now = target;
    await flushPromises();
  }

  /**
   * Fires timers one by one until `predicate` holds. Throws when it cannot
   * hold: no timer left, or more than `maxMs` of virtual time would pass.
   */
  async runUntil(predicate: () => boolean, maxMs = 30 * 60_000): Promise<void> {
    const limit = this.#now + maxMs;
    await flushPromises();
    while (!predicate()) {
      const timer = this.#earliest();
      if (!timer || timer.at > limit) {
        throw new Error(
          `runUntil: condition not met at t=${this.#now} (${timer ? `next timer at ${timer.at}` : "no pending timers"})`,
        );
      }
      await this.#fire(timer);
    }
  }

  #earliest(): Timer | undefined {
    let earliest: Timer | undefined;
    for (const timer of this.#timers) {
      if (
        !earliest ||
        timer.at < earliest.at ||
        (timer.at === earliest.at && timer.id < earliest.id)
      ) {
        earliest = timer;
      }
    }
    return earliest;
  }

  async #fire(timer: Timer): Promise<void> {
    this.#timers = this.#timers.filter((entry) => entry !== timer);
    this.#now = Math.max(this.#now, timer.at);
    timer.fire();
    await flushPromises();
  }
}

export interface LogEvent {
  name: string;
  data?: Record<string, string | number | boolean>;
}

export class MemoryLog implements Log {
  readonly events: LogEvent[] = [];

  event(name: string, data?: Record<string, string | number | boolean>): void {
    this.events.push(data === undefined ? { name } : { name, data });
  }
}

// ---------------------------------------------------------------------------
// World configuration

/** A home-network access point. `password` is "" for open networks. */
export interface FakeAccessPoint {
  ssid: string;
  bssid: string;
  frequencyMHz: number;
  level: number;
  capabilities: string;
  password: string;
}

/**
 * How `POST /addWirelessProfile` replies:
 * - `verdict`: OK or `WIFI_PROFILE_SETUP_FAILED` once the join attempt ends (measured);
 * - `never`: the speaker joins (or not) but never replies;
 * - `dropLink`: the link drops when the request is sent; the request fails;
 * - `apiError` / `httpStatus`: another error reply.
 */
export type AddProfileReply =
  | "verdict"
  | "never"
  | "dropLink"
  | { apiError: { errorName: string; value: number; message: string } }
  | { httpStatus: number };

export interface FakeSpeakerConfig {
  /** `/info` deviceID = mDNS TXT `MAC`; its last 6 characters end the setup SSID. */
  deviceID: string;
  name: string;
  type: string;
  /** Setup SSID model part: `Bose <model> (<suffix>)`. */
  model: string;
  /** Setup network BSSID. */
  bssid: string;
  /** Setup network RSSI. */
  level: number;
  /** Address the home router gives the speaker. */
  homeIp: string;
  /** In setup mode (setup network broadcasting) at start. Default true. */
  setupMode?: boolean;
  /** Already on a home network before credentials are sent (re-setup of a configured speaker). */
  preconfigured?: { ssid: string };
  /** `addWirelessProfile` duration with correct credentials. Default 7 s. */
  okDelayMs?: number;
  /** `addWirelessProfile` duration with wrong credentials. Default 35 s. */
  failDelayMs?: number;
  addProfileReply?: AddProfileReply;
  /** `wlan0` reports its address this long after joining. Default 3 s. */
  wlan0DelayMs?: number;
  /** `/networkInfo` never shows a `wlan0` address. */
  hideWlan0Address?: boolean;
  /** `SETUP_LEAVE` over the setup network: `fails` (transport error, no effect), `hangs` (no reply, no effect). Default `ok`. */
  leaveOverLink?: "ok" | "fails" | "hangs";
  /** API silent after `SETUP_LEAVE`. Default 3 s. */
  leavePauseMs?: number;
  /** Setup network shuts down this long after `SETUP_LEAVE`. Default 10 s. */
  apShutdownMs?: number;
  /** `/info` stays silent this long after the phone binds to the setup network. */
  silentAfterLinkMs?: number;
  /** Announces itself over mDNS while on a home network. Default true. */
  announces?: boolean;
  /** `POST /name` replies HTTP 500 and the name stays. */
  renameFails?: boolean;
}

export type JoinOutcome = "ok" | "rejected" | "hang";

export interface FakeWorldConfig {
  homeNetworks: FakeAccessPoint[];
  speakers: FakeSpeakerConfig[];
  phone?: {
    wifiEnabled?: boolean;
    /** Home SSID the phone is on. Default: first home network. */
    ssid?: string;
    /** After `release()`, the phone is off Wi-Fi; restored after `restoreAfterMs` (`null`: never). */
    losesHomeOnRelease?: { restoreAfterMs: number | null };
  };
  permissions?: {
    granted?: boolean;
    fine?: boolean;
    canAskAgain?: boolean;
    servicesEnabled?: boolean;
    /** State after the user answers the system dialog. Default: unchanged. */
    onRequest?: { granted: boolean; fine: boolean; canAskAgain: boolean };
    /** How long the system dialog stays open. */
    dialogMs?: number;
  };
  join?: {
    /** One per `wifi.join` call; the last one repeats. Default `["ok"]`. */
    outcomes?: JoinOutcome[];
    /** Request → `onAvailable`. Default 4.5 s. */
    delayMs?: number;
  };
  scan?: {
    /** The first N scans miss every setup network. */
    missSetupScans?: number;
    /** Scans return `cached` with `fresh: false`. */
    throttled?: boolean;
    cached?: ScanResult[];
  };
}

export interface PortCall {
  port: "wifi" | "speaker" | "discovery" | "permissions";
  method: string;
  at: number;
}

// ---------------------------------------------------------------------------
// Speaker

/** The open setup network a speaker broadcasts: `Bose <model> (<last 6 of deviceID>)` on 2.4 GHz channel 1. */
export function setupScanResult(config: FakeSpeakerConfig): ScanResult {
  return {
    ssid: `Bose ${config.model} (${config.deviceID.slice(-6)})`,
    bssid: config.bssid,
    frequencyMHz: 2412,
    level: config.level,
    capabilities: "[ESS]",
  };
}

export class FakeSpeaker {
  readonly config: FakeSpeakerConfig;
  readonly #world: FakeWorld;
  setupMode: boolean;
  apUp: boolean;
  /** Current `/info` name; `POST /name` changes it. */
  name: string;
  /** `POST /name` fails while set (initially `config.renameFails`). */
  renameFails: boolean;
  /** Names received by `POST /name` that took effect. */
  readonly renames: string[] = [];
  station: { ssid: string; ip: string } | null;
  wlan0VisibleAt = 0;
  pausedUntil = Number.NEGATIVE_INFINITY;
  linkedAt = Number.NEGATIVE_INFINITY;
  /** Every profile received, in order (test-only: holds passwords). */
  readonly profiles: Credentials[] = [];
  /** `SETUP_LEAVE` requests that took effect, with the route they came over. */
  readonly leaves: ("link" | "home")[] = [];

  constructor(world: FakeWorld, config: FakeSpeakerConfig) {
    this.#world = world;
    this.config = config;
    this.setupMode = config.setupMode ?? true;
    this.apUp = this.setupMode;
    this.name = config.name;
    this.renameFails = config.renameFails ?? false;
    this.station = config.preconfigured
      ? { ssid: config.preconfigured.ssid, ip: config.homeIp }
      : null;
  }

  get deviceID(): string {
    return this.config.deviceID;
  }

  get setupSsid(): string {
    return setupScanResult(this.config).ssid;
  }

  get setupState(): "SETUP_AP_OOB" | "SETUP_INACTIVE" {
    return this.setupMode ? "SETUP_AP_OOB" : "SETUP_INACTIVE";
  }

  get scanResult(): ScanResult {
    return setupScanResult(this.config);
  }

  info(): SpeakerInfo {
    return {
      deviceID: this.config.deviceID,
      name: this.name,
      type: this.config.type,
    };
  }

  interfaces(): SpeakerInterface[] {
    const { station } = this;
    const now = this.#world.clock.now();
    const wlan0: SpeakerInterface = { name: "wlan0" };
    if (station) {
      wlan0.ssid = station.ssid;
      if (!this.config.hideWlan0Address && now >= this.wlan0VisibleAt) {
        wlan0.ipAddress = station.ip;
      }
    }
    // `state` lies while in setup mode (measured).
    wlan0.state =
      station && !this.setupMode
        ? "NETWORK_WIFI_CONNECTED"
        : "NETWORK_WIFI_DISCONNECTED";
    if (!this.setupMode && station) {
      wlan0.mode = "STATION";
    }
    const interfaces = [wlan0];
    if (this.apUp) {
      interfaces.push({
        name: "wlan1",
        ipAddress: SETUP_IP,
        ssid: this.setupSsid,
        frequencyKHz: 2_412_000,
        state: "NETWORK_WIFI_CONNECTED",
        mode: "ACCESS_POINT",
      });
    }
    return interfaces;
  }

  /** Starts a join attempt; returns when it ends and whether it worked. */
  addProfile(credentials: Credentials): { delayMs: number; joined: boolean } {
    this.profiles.push({ ...credentials });
    const network = this.#world.config.homeNetworks.find(
      (entry) => entry.ssid === credentials.ssid,
    );
    const joined = network?.password === credentials.password;
    const delayMs = joined
      ? (this.config.okDelayMs ?? 7000)
      : (this.config.failDelayMs ?? 35_000);
    this.#world.clock.schedule(delayMs, () => {
      if (joined) {
        this.station = { ssid: credentials.ssid, ip: this.config.homeIp };
        this.wlan0VisibleAt =
          this.#world.clock.now() + (this.config.wlan0DelayMs ?? 3000);
        this.#world.changed();
      }
    });
    return { delayMs, joined };
  }

  /** `SETUP_LEAVE`: API pause, setup state inactive, setup network down later. */
  leave(route: "link" | "home"): void {
    const { clock } = this.#world;
    this.leaves.push(route);
    this.setupMode = false;
    this.pausedUntil = clock.now() + (this.config.leavePauseMs ?? 3000);
    clock.schedule(this.config.apShutdownMs ?? 10_000, () => {
      this.apUp = false;
      this.#world.wifi.speakerApDown(this);
      this.#world.changed();
    });
  }

  isPaused(): boolean {
    return this.#world.clock.now() < this.pausedUntil;
  }

  isSilentAfterLink(): boolean {
    return (
      this.#world.clock.now() <
      this.linkedAt + (this.config.silentAfterLinkMs ?? 0)
    );
  }
}

// ---------------------------------------------------------------------------
// Wi-Fi

class FakeLink implements Link {
  readonly #lost = new Set<() => void>();
  readonly #restored = new Set<() => void>();

  onLost(cb: () => void): () => void {
    this.#lost.add(cb);
    return () => {
      this.#lost.delete(cb);
    };
  }

  onRestored(cb: () => void): () => void {
    this.#restored.add(cb);
    return () => {
      this.#restored.delete(cb);
    };
  }

  emit(kind: "lost" | "restored"): void {
    for (const cb of kind === "lost" ? [...this.#lost] : [...this.#restored]) {
      cb();
    }
  }

  detach(): void {
    this.#lost.clear();
    this.#restored.clear();
  }
}

export class FakeWifi implements WifiPort {
  readonly #world: FakeWorld;
  readonly #listeners = new Set<(state: NetworkState) => void>();
  readonly #outcomes: JoinOutcome[];
  #enabled: boolean;
  #network: NetworkState;
  #link: FakeLink | undefined;
  #scans = 0;
  #cache: ScanResult[];
  #settlePending: (() => void) | undefined;
  /** Scans return the cache with `fresh: false` while set. */
  throttled: boolean;
  /** The next N scans throw (a port failure the session does not model). */
  failNextScans = 0;
  /** BSSID of the setup network the user joined in the system settings (manual path). */
  manualConnection: string | null = null;
  boundTo: FakeSpeaker | undefined;
  linkUp = false;
  pendingJoins = 0;
  releaseCount = 0;
  panelOpened = 0;
  settingsOpened = 0;
  readonly joins: { ssid: string; bssid: string }[] = [];
  readonly scanTimes: number[] = [];

  constructor(world: FakeWorld) {
    this.#world = world;
    const { phone, join, scan } = world.config;
    this.#enabled = phone?.wifiEnabled ?? true;
    this.#network = this.#homeState();
    this.#outcomes = [...(join?.outcomes ?? ["ok"])];
    this.throttled = scan?.throttled ?? false;
    this.#cache = scan?.cached ?? [];
  }

  // Test controls ------------------------------------------------------------

  get network(): NetworkState {
    return this.#network;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    this.setNetwork(this.#homeState());
  }

  setNetwork(state: NetworkState): void {
    this.#network = state;
    for (const listener of [...this.#listeners]) {
      listener(state);
    }
    this.#world.changed();
  }

  /** Android reports the setup network lost (`onLost`). */
  loseLink(): void {
    if (this.#link && this.linkUp) {
      this.linkUp = false;
      this.#link.emit("lost");
    }
  }

  /** Android re-acquires the setup network (`onAvailable` after a loss). */
  restoreLink(): void {
    if (this.#link && !this.linkUp && this.boundTo?.apUp) {
      this.linkUp = true;
      this.#link.emit("restored");
    }
  }

  /**
   * The user connected the phone to `speaker`'s setup network in the Wi-Fi
   * settings (manual path); the phone returns home when that network goes down.
   */
  connectManually(speaker: FakeSpeaker): void {
    this.manualConnection = speaker.config.bssid;
    this.setNetwork({ transport: "wifi", ssid: speaker.setupSsid });
  }

  speakerApDown(speaker: FakeSpeaker): void {
    if (this.boundTo === speaker) {
      this.loseLink();
    }
    if (this.#network.ssid === speaker.setupSsid) {
      this.setNetwork(this.#homeState());
    }
  }

  // WifiPort ----------------------------------------------------------------

  async isEnabled(): Promise<boolean> {
    this.#world.record("wifi", "isEnabled");
    return this.#enabled;
  }

  async scan(
    _signal: AbortSignal,
  ): Promise<{ results: ScanResult[]; fresh: boolean }> {
    this.#world.record("wifi", "scan");
    this.scanTimes.push(this.#world.clock.now());
    if (this.failNextScans > 0) {
      this.failNextScans--;
      throw new Error("Wi-Fi scan failed");
    }
    if (this.throttled) {
      return { results: [...this.#cache], fresh: false };
    }
    this.#scans++;
    const missSetup =
      this.#scans <= (this.#world.config.scan?.missSetupScans ?? 0);
    const results: ScanResult[] = this.#world.config.homeNetworks.map(
      ({ password: _password, ...ap }) => ap,
    );
    if (!missSetup) {
      for (const speaker of this.#world.speakers) {
        if (speaker.apUp) {
          results.push(speaker.scanResult);
        }
      }
    }
    this.#cache = results;
    return { results: [...results], fresh: true };
  }

  async currentNetwork(): Promise<NetworkState> {
    this.#world.record("wifi", "currentNetwork");
    return this.#network;
  }

  onNetworkChange(cb: (state: NetworkState) => void): () => void {
    this.#world.record("wifi", "onNetworkChange");
    this.#listeners.add(cb);
    return () => {
      this.#listeners.delete(cb);
    };
  }

  async join(
    target: { ssid: string; bssid: string },
    signal: AbortSignal,
  ): Promise<Result<Link, JoinRejected>> {
    this.#world.record("wifi", "join");
    this.joins.push({ ...target });
    // One request at a time: a new join supersedes the pending one.
    this.#settlePending?.();
    const outcome =
      this.#outcomes.length > 1 ? this.#outcomes.shift()! : this.#outcomes[0];
    const rejected = () => Result.err(new JoinRejected({ ssid: target.ssid }));
    const { clock, speakers, config } = this.#world;
    this.pendingJoins++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (finish: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        this.pendingJoins--;
        cancelTimer();
        signal.removeEventListener("abort", onAbort);
        if (this.#settlePending === supersede) {
          this.#settlePending = undefined;
        }
        finish();
      };
      const onAbort = () => {
        settle(() => {
          reject(new AbortedError());
        });
      };
      const supersede = () => {
        settle(() => {
          resolve(rejected());
        });
      };
      // Android answers after the request delay (`onAvailable` / `onUnavailable`), or never.
      const cancelTimer =
        outcome === "hang"
          ? () => undefined
          : clock.schedule(config.join?.delayMs ?? 4500, () => {
              const speaker = speakers.find(
                (entry) => entry.config.bssid === target.bssid && entry.apUp,
              );
              settle(() => {
                resolve(
                  outcome === "rejected" || !speaker
                    ? rejected()
                    : Result.ok(this.#bind(speaker)),
                );
              });
            });
      this.#settlePending = supersede;
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
    });
  }

  async bindToConnectedWifi(): Promise<Result<Link, ManualJoinNotConnected>> {
    this.#world.record("wifi", "bindToConnectedWifi");
    const speaker = this.#world.speakers.find(
      (entry) => entry.config.bssid === this.manualConnection && entry.apUp,
    );
    return speaker
      ? Result.ok(this.#bind(speaker))
      : Result.err(new ManualJoinNotConnected());
  }

  async release(): Promise<void> {
    this.#world.record("wifi", "release");
    this.releaseCount++;
    this.#settlePending?.();
    const wasBound = this.boundTo !== undefined;
    this.#link?.detach();
    this.#link = undefined;
    this.boundTo = undefined;
    this.linkUp = false;
    const loses = this.#world.config.phone?.losesHomeOnRelease;
    if (wasBound && loses) {
      this.setNetwork({ transport: "cellular", ssid: null });
      if (loses.restoreAfterMs !== null) {
        this.#world.clock.schedule(loses.restoreAfterMs, () => {
          this.setNetwork(this.#homeState());
        });
      }
    }
    this.#world.changed();
  }

  async openWifiPanel(): Promise<void> {
    this.#world.record("wifi", "openWifiPanel");
    this.panelOpened++;
  }

  async openWifiSettings(): Promise<void> {
    this.#world.record("wifi", "openWifiSettings");
    this.settingsOpened++;
  }

  #homeState(): NetworkState {
    const ssid =
      this.#world.config.phone?.ssid ??
      this.#world.config.homeNetworks[0]?.ssid ??
      null;
    return this.#enabled
      ? { transport: "wifi", ssid }
      : { transport: "cellular", ssid: null };
  }

  #bind(speaker: FakeSpeaker): Link {
    this.#link?.detach();
    const link = new FakeLink();
    this.#link = link;
    this.boundTo = speaker;
    this.linkUp = true;
    speaker.linkedAt = this.#world.clock.now();
    return link;
  }
}

// ---------------------------------------------------------------------------
// Speaker HTTP

type Route = { speaker: FakeSpeaker; via: "link" | "home" } | undefined;

/** Routes requests like the phone would: everything over the link while bound, else the home network. */
export class FakeSpeakerHttp implements SpeakerHttp {
  readonly #world: FakeWorld;

  constructor(world: FakeWorld) {
    this.#world = world;
  }

  async info(
    ip: string,
    signal: AbortSignal,
  ): Promise<Result<SpeakerInfo, SpeakerError>> {
    this.#world.record("speaker", "info");
    const route = this.#reachable(ip);
    if (!route || route.speaker.isSilentAfterLink()) {
      return hang(signal);
    }
    return Result.ok(route.speaker.info());
  }

  async sendCredentials(
    ip: string,
    credentials: Credentials,
    signal: AbortSignal,
  ): Promise<Result<void, SpeakerError>> {
    this.#world.record("speaker", "sendCredentials");
    const route = this.#reachable(ip);
    if (!route) {
      return hang(signal);
    }
    const { speaker } = route;
    const reply = speaker.config.addProfileReply ?? "verdict";
    if (typeof reply === "object" && "httpStatus" in reply) {
      return Result.err(
        new SpeakerResponseError({ message: `HTTP ${reply.httpStatus}` }),
      );
    }
    const attempt = speaker.addProfile(credentials);
    if (reply === "dropLink") {
      this.#world.wifi.loseLink();
      return Result.err(
        new SpeakerTransportError({ message: "Network request failed" }),
      );
    }
    if (reply === "never") {
      return hang(signal);
    }
    const verdict: Result<void, SpeakerError> =
      typeof reply === "object"
        ? Result.err(new SpeakerApiError(reply.apiError))
        : attempt.joined
          ? Result.ok(undefined)
          : Result.err(
              new SpeakerApiError({
                errorName: "WIFI_PROFILE_SETUP_FAILED",
                value: 1035,
                message: "NO_IP_ADDRESS_ASSIGNED",
              }),
            );
    return this.#replyLater(route, attempt.delayMs, verdict, signal);
  }

  async networkInfo(
    ip: string,
    signal: AbortSignal,
  ): Promise<Result<{ interfaces: SpeakerInterface[] }, SpeakerError>> {
    this.#world.record("speaker", "networkInfo");
    const route = this.#reachable(ip);
    if (!route) {
      return hang(signal);
    }
    return Result.ok({ interfaces: route.speaker.interfaces() });
  }

  async setupState(
    ip: string,
    signal: AbortSignal,
  ): Promise<Result<{ state: string }, SpeakerError>> {
    this.#world.record("speaker", "setupState");
    const route = this.#reachable(ip);
    if (!route) {
      return hang(signal);
    }
    return Result.ok({ state: route.speaker.setupState });
  }

  async leaveSetup(
    ip: string,
    signal: AbortSignal,
  ): Promise<Result<void, SpeakerError>> {
    this.#world.record("speaker", "leaveSetup");
    const route = this.#reachable(ip);
    if (!route) {
      return hang(signal);
    }
    const overLink =
      route.via === "link"
        ? (route.speaker.config.leaveOverLink ?? "ok")
        : "ok";
    if (overLink === "hangs") {
      return hang(signal);
    }
    if (overLink === "fails") {
      return Result.err(
        new SpeakerTransportError({ message: "Network request failed" }),
      );
    }
    route.speaker.leave(route.via);
    return Result.ok(undefined);
  }

  async setName(
    ip: string,
    name: string,
    signal: AbortSignal,
  ): Promise<Result<void, SpeakerError>> {
    this.#world.record("speaker", "setName");
    const route = this.#reachable(ip);
    if (!route) {
      return hang(signal);
    }
    if (route.speaker.renameFails) {
      return Result.err(new SpeakerResponseError({ message: "HTTP 500" }));
    }
    route.speaker.name = name;
    route.speaker.renames.push(name);
    return Result.ok(undefined);
  }

  #route(ip: string): Route {
    const { wifi, speakers } = this.#world;
    if (wifi.boundTo) {
      return ip === SETUP_IP && wifi.linkUp && wifi.boundTo.apUp
        ? { speaker: wifi.boundTo, via: "link" }
        : undefined;
    }
    const { network } = wifi;
    if (network.transport !== "wifi") {
      return undefined;
    }
    const speaker = speakers.find(
      (entry) =>
        entry.station?.ip === ip && entry.station.ssid === network.ssid,
    );
    return speaker ? { speaker, via: "home" } : undefined;
  }

  /** The route, unless the speaker's API is paused (requests then time out). */
  #reachable(ip: string): Route {
    const route = this.#route(ip);
    return route && !route.speaker.isPaused() ? route : undefined;
  }

  /** Replies after `delayMs` if the route still works then; otherwise the request hangs. */
  async #replyLater<Value>(
    route: NonNullable<Route>,
    delayMs: number,
    reply: Result<Value, SpeakerError>,
    signal: AbortSignal,
  ): Promise<Result<Value, SpeakerError>> {
    return new Promise((resolve) => {
      const onAbort = () => {
        cancel();
        resolve(Result.err(new SpeakerTransportError({ message: "Aborted" })));
      };
      const cancel = this.#world.clock.schedule(delayMs, () => {
        const still = this.#route(
          route.via === "link" ? SETUP_IP : route.speaker.config.homeIp,
        );
        if (still?.speaker === route.speaker) {
          signal.removeEventListener("abort", onAbort);
          resolve(reply);
        }
      });
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
    });
  }
}

/** A request nobody answers: settles with a transport error when aborted. */
async function hang<Value>(
  signal: AbortSignal,
): Promise<Result<Value, SpeakerError>> {
  return new Promise((resolve) => {
    const onAbort = () => {
      resolve(Result.err(new SpeakerTransportError({ message: "Aborted" })));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort);
  });
}

// ---------------------------------------------------------------------------
// Discovery and permissions

export class FakeDiscovery implements Discovery {
  readonly #world: FakeWorld;

  constructor(world: FakeWorld) {
    this.#world = world;
  }

  async *browse(signal: AbortSignal): AsyncGenerator<DiscoveredService> {
    this.#world.record("discovery", "browse");
    const seen = new Set<string>();
    while (!signal.aborted) {
      for (const service of this.#world.announcements()) {
        const key = `${service.mac}@${service.host}`;
        if (!seen.has(key)) {
          seen.add(key);
          yield service;
        }
      }
      if (!(await this.#world.nextChange(signal))) {
        return;
      }
    }
  }
}

export class FakePermissions implements Permissions {
  readonly #world: FakeWorld;
  state: { granted: boolean; fine: boolean; canAskAgain: boolean };
  servicesEnabled: boolean;
  /** State after the next system dialog; `undefined` leaves it unchanged. */
  onRequest:
    | { granted: boolean; fine: boolean; canAskAgain: boolean }
    | undefined;
  requests = 0;
  appSettingsOpened = 0;
  locationSettingsOpened = 0;

  constructor(world: FakeWorld) {
    this.#world = world;
    const config = world.config.permissions;
    this.state = {
      granted: config?.granted ?? true,
      fine: config?.fine ?? true,
      canAskAgain: config?.canAskAgain ?? true,
    };
    this.servicesEnabled = config?.servicesEnabled ?? true;
    this.onRequest = config?.onRequest;
  }

  async location(
    request: boolean,
  ): Promise<{ granted: boolean; fine: boolean; canAskAgain: boolean }> {
    this.#world.record("permissions", "location");
    if (request && !(this.state.granted && this.state.fine)) {
      this.requests++;
      const dialogMs = this.#world.config.permissions?.dialogMs ?? 0;
      if (dialogMs > 0) {
        await new Promise<void>((resolve) => {
          this.#world.clock.schedule(dialogMs, resolve);
        });
      }
      if (this.onRequest) {
        this.state = { ...this.onRequest };
      }
    }
    return { ...this.state };
  }

  async locationServicesEnabled(): Promise<boolean> {
    this.#world.record("permissions", "locationServicesEnabled");
    return this.servicesEnabled;
  }

  async openAppSettings(): Promise<void> {
    this.#world.record("permissions", "openAppSettings");
    this.appSettingsOpened++;
  }

  async openLocationSettings(): Promise<void> {
    this.#world.record("permissions", "openLocationSettings");
    this.locationSettingsOpened++;
  }
}

// ---------------------------------------------------------------------------
// World

/**
 * A phone, its home networks and SoundTouch speakers, wired together:
 * joining binds the phone to a speaker's setup network, HTTP requests are
 * routed like on the device, and speakers announce themselves over mDNS once
 * they are on the phone's network.
 */
export class FakeWorld {
  readonly config: FakeWorldConfig;
  readonly clock: SchedulingClock;
  readonly log = new MemoryLog();
  readonly calls: PortCall[] = [];
  readonly speakers: FakeSpeaker[];
  readonly wifi: FakeWifi;
  readonly http: FakeSpeakerHttp;
  readonly discovery: FakeDiscovery;
  readonly permissions: FakePermissions;
  readonly #changeWaiters = new Set<() => void>();

  constructor(
    config: FakeWorldConfig,
    clock: SchedulingClock = new ManualClock(),
  ) {
    this.config = config;
    this.clock = clock;
    this.speakers = config.speakers.map(
      (entry) => new FakeSpeaker(this, entry),
    );
    this.wifi = new FakeWifi(this);
    this.http = new FakeSpeakerHttp(this);
    this.discovery = new FakeDiscovery(this);
    this.permissions = new FakePermissions(this);
  }

  get deps(): SetupDeps {
    return {
      wifi: this.wifi,
      speaker: this.http,
      discovery: this.discovery,
      permissions: this.permissions,
      clock: this.clock,
      log: this.log,
    };
  }

  speaker(deviceID: string): FakeSpeaker {
    const speaker = this.speakers.find((entry) => entry.deviceID === deviceID);
    if (!speaker) {
      throw new Error(`No fake speaker ${deviceID}`);
    }
    return speaker;
  }

  record(port: PortCall["port"], method: string): void {
    this.calls.push({ port, method, at: this.clock.now() });
  }

  /** Services visible to an mDNS browse from the phone right now. */
  announcements(): DiscoveredService[] {
    const { network } = this.wifi;
    if (network.transport !== "wifi") {
      return [];
    }
    return this.speakers
      .filter(
        (speaker) =>
          (speaker.config.announces ?? true) &&
          speaker.station?.ssid === network.ssid,
      )
      .map((speaker) => ({
        host: speaker.station?.ip ?? "",
        port: 8090,
        mac: speaker.deviceID,
      }));
  }

  changed(): void {
    const waiters = [...this.#changeWaiters];
    this.#changeWaiters.clear();
    for (const waiter of waiters) {
      waiter();
    }
  }

  /** Resolves `true` on the next change, `false` when `signal` aborts. */
  async nextChange(signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false);
        return;
      }
      const onAbort = () => {
        this.#changeWaiters.delete(waiter);
        resolve(false);
      };
      const waiter = () => {
        signal.removeEventListener("abort", onAbort);
        resolve(true);
      };
      this.#changeWaiters.add(waiter);
      signal.addEventListener("abort", onAbort);
    });
  }
}
