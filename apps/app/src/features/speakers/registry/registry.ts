import type { Speaker, SpeakerState } from "bose-api-speaker-client";

import { isSameOrigin } from "../lib/account-id";
import type { KnownSpeaker } from "../lib/known-speakers";
import type { SpeakerServer } from "../lib/server-profiles";
import type { SpeakerLink, SpeakerRegistryDeps } from "./ports";
import type {
  BoseSpeaker,
  ScanKind,
  SpeakersSnapshot,
  SpeakerStatus,
} from "./types";

/** One listed speaker: who and where it is, its server, and its state once reached. */
interface SpeakerRecord {
  readonly deviceID: string;
  readonly name: string;
  readonly type: string;
  readonly host: string;
  readonly port: number;
  readonly status: SpeakerStatus;
  /** The server it uses, as last checked; absent until it has been. */
  readonly server?: SpeakerServer;
  /** What it last showed; absent until it's reached. */
  readonly live?: SpeakerState;
}

function toView(record: SpeakerRecord): BoseSpeaker {
  const { live } = record;
  return {
    deviceID: record.deviceID,
    status: record.status,
    host: record.host,
    port: record.port,
    name: record.name,
    type: record.type,
    server: record.server,
    playStatus: live?.nowPlaying?.playStatus,
    source: live?.nowPlaying?.source,
    track: live?.nowPlaying?.track,
    artist: live?.nowPlaying?.artist,
    album: live?.nowPlaying?.album,
    artUrl: live?.nowPlaying?.artUrl,
    volume: live?.volume,
    muteEnabled: live?.isMuted,
    presets: live?.presets,
    bass: live?.bass,
    bassCapabilities: live?.bassCapabilities,
    capabilities: live?.capabilities,
    audioDspControls: live?.audioDspControls,
    audioProductToneControls: live?.audioProductToneControls,
    audioProductLevelControls: live?.audioProductLevelControls,
    components: live?.components,
    macAddress: live?.macAddress,
    margeAccountUUID: live?.margeAccountUUID,
    margeURL: live?.margeURL,
  };
}

const known = ({
  deviceID,
  name,
  type,
  host,
  port,
  server,
}: SpeakerRecord | KnownSpeaker): KnownSpeaker => ({
  deviceID,
  name,
  type,
  host,
  port,
  server,
});

export type SpeakerRegistry = ReturnType<typeof createSpeakerRegistry>;

/**
 * The speakers the app lists, by device id: the remembered ones, listed at
 * once with the server they used last time, and the ones found on the
 * network. Reaching a speaker opens its live connection and checks its
 * server (`identifyServer`); the server is checked again when the speaker
 * reports another `margeURL`, when the app comes back, when our server
 * changes, and when asked. What's listed is remembered for the next launch.
 */
export function createSpeakerRegistry(
  deps: SpeakerRegistryDeps,
  { scanDurationMs = 5000 }: { scanDurationMs?: number } = {},
) {
  const records = new Map<string, SpeakerRecord>();
  const links = new Map<string, SpeakerLink>();
  /**
   * Bumped by each `forget`, which records the new value for the speaker: a
   * connection started before that can't bring it back.
   */
  let forgetCount = 0;
  const forgottenAt = new Map<string, number>();
  /** The `margeURL` each speaker's server was last checked for. */
  const checkedFor = new Map<string, string>();
  /** Bumped by each server check: only the latest one for a speaker applies. */
  const serverChecks = new Map<string, number>();

  let restoring: Promise<void> | undefined;
  let restored = false;
  let scan: ScanKind | null = null;
  let error: string | null = null;
  let stopScanner: (() => void) | undefined;
  let cancelScanEnd: (() => void) | undefined;
  /** The list as last stored. */
  let saved: string | undefined;

  const listeners = new Set<() => void>();
  let snapshot = takeSnapshot();

  function takeSnapshot(): SpeakersSnapshot {
    const listed = [...records.values()].map(toView);
    return {
      listed,
      online: listed.filter((speaker) => speaker.status === "online"),
      restored,
      scan,
      error,
    };
  }

  function persist(): void {
    if (!restored) {
      return;
    }
    const list = [...records.values()].map(known);
    const serialized = JSON.stringify(list);
    if (serialized !== saved) {
      saved = serialized;
      void deps.storage.save(list);
    }
  }

  function changed(): void {
    // An automatic scan ends once every listed speaker has answered; one the
    // user asked for runs its full length to find new speakers.
    if (
      scan === "auto" &&
      records.size > 0 &&
      [...records.values()].every((record) => record.status === "online")
    ) {
      endScan();
      return;
    }
    snapshot = takeSnapshot();
    persist();
    for (const listener of listeners) {
      listener();
    }
  }

  function setStatus(deviceID: string, status: SpeakerStatus): void {
    const record = records.get(deviceID);
    if (record) {
      records.set(deviceID, { ...record, status });
      changed();
    }
  }

  /** Stores the speaker's presets on our server when it uses ours. */
  function syncPresets(deviceID: string, state: SpeakerState): void {
    const accountId = state.margeAccountUUID;
    if (
      state.presets &&
      accountId &&
      isSameOrigin(state.margeURL, deps.ourServer.url())
    ) {
      deps.ourServer
        .syncPresets(accountId, deviceID, state.presets)
        .catch((err: unknown) => {
          deps.log.warn("[speakers] Could not sync presets:", err);
        });
    }
  }

  /** Checks which server the speaker uses, for the `margeURL` it reports. */
  async function checkServer(
    deviceID: string,
    margeURL: string,
  ): Promise<void> {
    const host = records.get(deviceID)?.host;
    if (host === undefined) {
      return;
    }
    const check = (serverChecks.get(deviceID) ?? 0) + 1;
    serverChecks.set(deviceID, check);
    checkedFor.set(deviceID, margeURL);
    let server: SpeakerServer;
    try {
      server = await deps.speaker.server(
        { host, margeURL },
        deps.ourServer.url(),
      );
    } catch (err) {
      deps.log.warn(
        `[speakers] Could not check the server of ${deviceID}:`,
        err,
      );
      return;
    }
    const record = records.get(deviceID);
    if (serverChecks.get(deviceID) === check && record) {
      records.set(deviceID, { ...record, server });
      changed();
    }
  }

  /** The speaker's state, read through `link`: listed online with it. */
  function publish(
    deviceID: string,
    link: SpeakerLink,
    state: SpeakerState,
  ): void {
    syncPresets(deviceID, state);
    const record = records.get(deviceID);
    records.set(deviceID, {
      deviceID,
      name: state.name ?? record?.name ?? "Bose Speaker",
      type: state.type ?? "SoundTouch",
      host: link.host,
      port: link.port,
      status: "online",
      server: record?.server,
      live: state,
    });
    changed();
    if (state.margeURL && checkedFor.get(deviceID) !== state.margeURL) {
      void checkServer(deviceID, state.margeURL);
    }
  }

  /**
   * Reaches the speaker answering at `address` and keeps it connected: it's
   * listed once its state is read, not before. With `expectedDeviceID` (a
   * remembered speaker), another device at that address is ignored.
   * Resolves to whether the speaker answered.
   */
  async function connectAt(
    address: string,
    port: number,
    expectedDeviceID?: string,
  ): Promise<boolean> {
    const startedAt = forgetCount;
    const info = await deps.speaker.info(address, port);
    if (!info) {
      return false;
    }
    const { deviceID } = info;
    if (
      !deviceID ||
      (expectedDeviceID !== undefined && deviceID !== expectedDeviceID) ||
      (forgottenAt.get(deviceID) ?? -1) > startedAt
    ) {
      return false;
    }
    const existing = links.get(deviceID);
    if (
      existing?.host === address &&
      existing.port === port &&
      existing.isConnected()
    ) {
      return true;
    }
    existing?.close();

    const link: SpeakerLink = deps.speaker.link(
      address,
      port,
      deviceID,
      (state) => {
        if (links.get(deviceID) === link) {
          publish(deviceID, link, state);
        }
      },
    );
    links.set(deviceID, link);
    const state = await link.open();
    if (links.get(deviceID) === link) {
      publish(deviceID, link, state);
    }
    return true;
  }

  /** Tries a listed speaker at its last address; offline if it doesn't answer. */
  async function reachRemembered(deviceID: string): Promise<void> {
    const record = records.get(deviceID);
    if (!record) {
      return;
    }
    const answered = await connectAt(record.host, record.port, deviceID).catch(
      (err: unknown) => {
        deps.log.warn(`[speakers] ${deviceID} didn't answer:`, err);
        return false;
      },
    );
    // Meanwhile the scan may have reached it at another address.
    if (!answered && records.get(deviceID)?.status !== "online") {
      setStatus(deviceID, "offline");
    }
  }

  /**
   * Reconnects a reached speaker and re-reads its state, or shows it offline
   * if it no longer answers; it's then reached again like a remembered one.
   */
  async function refreshReached(
    deviceID: string,
    link: SpeakerLink,
  ): Promise<void> {
    const info = await deps.speaker.info(link.host, link.port);
    if (links.get(deviceID) !== link) {
      return;
    }
    if (info) {
      link.reconnect();
      void checkServer(deviceID, info.margeURL);
      return;
    }
    links.delete(deviceID);
    link.close();
    setStatus(deviceID, "offline");
  }

  function endScan(): void {
    cancelScanEnd?.();
    cancelScanEnd = undefined;
    stopScanner?.();
    stopScanner = undefined;
    if (scan !== null) {
      scan = null;
      changed();
    }
  }

  function startScan(kind: ScanKind): void {
    endScan();
    scan = kind;
    error = null;
    try {
      stopScanner = deps.scanner.start(
        (host, port) => {
          connectAt(host, port).catch((err: unknown) => {
            deps.log.warn(
              `[speakers] Found ${host} but couldn't reach it:`,
              err,
            );
          });
        },
        (message) => {
          error = message;
          endScan();
        },
      );
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      scan = null;
      changed();
      return;
    }
    cancelScanEnd = deps.later(endScan, scanDurationMs);
    changed();
  }

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: (): SpeakersSnapshot => snapshot,

    /** Lists the remembered speakers, once; nothing is reached yet. */
    restore: async (): Promise<void> => {
      restoring ??= (async () => {
        const stored = await deps.storage.load();
        for (const entry of stored) {
          if (!records.has(entry.deviceID)) {
            records.set(entry.deviceID, { ...entry, status: "connecting" });
          }
        }
        restored = true;
        saved = JSON.stringify(stored.map(known));
        changed();
      })();
      return restoring;
    },

    /**
     * Reconnects every listed speaker (remembered ones at their last
     * address) and scans for the rest: on launch and when the app returns
     * to the foreground, where connections may have dropped while it was
     * away.
     */
    reconnectAll: (): void => {
      for (const record of records.values()) {
        const link = links.get(record.deviceID);
        if (link && record.status === "online") {
          void refreshReached(record.deviceID, link);
        } else {
          void reachRemembered(record.deviceID);
        }
      }
      startScan("auto");
    },

    /** A scan the user asked for: runs its full length to find new speakers. */
    rescan: (): void => {
      startScan("user");
    },

    /** An offline speaker, tried again: at its last address and by scanning. */
    retry: (deviceID: string): void => {
      const record = records.get(deviceID);
      if (!record || record.status === "online") {
        return;
      }
      setStatus(deviceID, "connecting");
      void reachRemembered(deviceID);
      startScan("auto");
    },

    /** Stops listing a speaker and remembering it, until a scan finds it again. */
    forget: (deviceID: string): void => {
      forgetCount += 1;
      forgottenAt.set(deviceID, forgetCount);
      const link = links.get(deviceID);
      links.delete(deviceID);
      link?.close();
      checkedFor.delete(deviceID);
      serverChecks.delete(deviceID);
      if (records.delete(deviceID)) {
        changed();
      }
    },

    /** The client of a reached speaker, for commands. */
    client: (deviceID: string): Speaker | undefined =>
      records.get(deviceID)?.status === "online"
        ? links.get(deviceID)?.client
        : undefined,

    /** Re-reads everything a reached speaker shows. */
    refresh: async (deviceID: string): Promise<void> => {
      await links.get(deviceID)?.refresh();
    },

    /** Checks again which server a listed speaker uses, from its `/info`. */
    refreshServer: async (deviceID: string): Promise<void> => {
      const record = records.get(deviceID);
      const info =
        record && (await deps.speaker.info(record.host, record.port));
      if (info) {
        await checkServer(deviceID, info.margeURL);
      }
    },

    /** Checks again which server every reached speaker uses: our server changed. */
    refreshAllServers: (): void => {
      for (const record of records.values()) {
        const margeURL = record.live?.margeURL;
        if (record.status === "online" && margeURL) {
          void checkServer(record.deviceID, margeURL);
        }
      }
    },

    /** Shows a volume the user just set, before the speaker confirms it. */
    showVolume: (deviceID: string, volume: number): void => {
      const record = records.get(deviceID);
      if (record?.live) {
        records.set(deviceID, {
          ...record,
          live: { ...record.live, volume },
        });
        changed();
      }
    },
  };
}
