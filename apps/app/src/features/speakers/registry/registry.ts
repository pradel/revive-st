import type { Speaker, SpeakerState } from "bose-api-speaker-client";

import { isSameOrigin } from "../lib/account-id";
import type { KnownSpeaker } from "../lib/known-speakers";
import { radioStatus, type SpeakerRadio } from "../lib/speaker-radio";
import {
  pairFromGroup,
  pairLedBy,
  partnersOf,
  type SpeakerPair,
} from "../lib/stereo-pair";
import type { SpeakerInfo, SpeakerLink, SpeakerRegistryDeps } from "./ports";
import type {
  BoseSpeaker,
  ScanKind,
  SpeakersSnapshot,
  SpeakerStatus,
} from "./types";

/** One listed speaker: who and where it is, its radio, and its live state. */
interface SpeakerRecord {
  readonly deviceID: string;
  readonly name: string;
  readonly type: string;
  readonly host: string;
  readonly port: number;
  readonly status: SpeakerStatus;
  /** As last read; kept while a later check runs or fails. */
  readonly radio?: SpeakerRadio;
  /** The latest radio check wasn't answered; cleared when another starts. */
  readonly radioFailed: boolean;
  /** Only while reached. */
  readonly live?: SpeakerState;
  /** The stereo pair it's in, as it last reported; remembered. */
  readonly pair?: SpeakerPair;
}

function toView(record: SpeakerRecord, ourServer: string): BoseSpeaker {
  const { live, pair } = record;
  return {
    deviceID: record.deviceID,
    status: record.status,
    host: record.host,
    port: record.port,
    name: pairLedBy(record)?.name ?? record.name,
    speakerName: record.name,
    type: record.type,
    radio: radioStatus(record.radio, record.radioFailed, ourServer),
    pair,
    pairStatus: pair && live?.group?.status,
    pairRead: live?.group !== undefined,
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

/** `value` unless the speaker left it out or empty. */
const filled = (value: string | undefined, fallback: string): string =>
  value === undefined || value === "" ? fallback : value;

const known = ({
  deviceID,
  name,
  type,
  host,
  port,
  radio,
  pair,
}: SpeakerRecord | KnownSpeaker): KnownSpeaker => ({
  deviceID,
  name,
  type,
  host,
  port,
  radio,
  pair,
});

export type SpeakerRegistry = ReturnType<typeof createSpeakerRegistry>;

/**
 * The speakers the app lists, by device id: the remembered ones, listed at
 * once with how they got radio last time, and the ones found on the network.
 * Reaching a speaker opens its live connection and checks its radio
 * (`SpeakerRadio`) at the same time, shown judged against our server
 * (`RadioStatus`); the radio is checked again when the app comes back, when
 * the speaker says its settings changed, and when asked. What's listed is
 * remembered for the next launch.
 */
export function createSpeakerRegistry(
  deps: SpeakerRegistryDeps,
  { scanDurationMs = 5000 }: { scanDurationMs?: number } = {},
) {
  const records = new Map<string, SpeakerRecord>();
  const links = new Map<string, SpeakerLink>();
  /** Bumped by each radio check: only the latest one for a speaker applies. */
  const radioChecks = new Map<string, number>();
  /** The `margeURL` each speaker's radio was last checked for. */
  const radioCheckedFor = new Map<string, string>();
  /** What was last sent to our server per speaker, so unchanged presets aren't sent again. */
  const syncedPresets = new Map<string, string>();
  /**
   * Bumped by each `forget`, which records the new value for the speaker: a
   * connection started before that can't bring it back.
   */
  let forgetCount = 0;
  const forgottenAt = new Map<string, number>();

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
    const ourServer = deps.ourServer.url();
    // By name, so the list doesn't depend on which speaker answered first.
    // `map` makes a new array, so it's sorted in place (Hermes lacks
    // `toSorted`).
    const all = [...records.values()]
      .map((record) => toView(record, ourServer))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.deviceID.localeCompare(b.deviceID),
      );
    // A pair is listed once, as its master, also while the master is
    // connecting or offline. A reached partner that reports no pair, or
    // another one, is listed on its own.
    const byID = new Map(all.map((speaker) => [speaker.deviceID, speaker]));
    const partners = new Set(
      all.flatMap((speaker) => {
        const pair = pairLedBy(speaker);
        return pair
          ? partnersOf(pair).filter((id) => {
              const partner = byID.get(id);
              return (
                partner?.status !== "online" || partner.pair?.id === pair.id
              );
            })
          : [];
      }),
    );
    const listed = all.filter((speaker) => !partners.has(speaker.deviceID));
    return {
      listed,
      online: listed.filter((speaker) => speaker.status === "online"),
      all,
      restored,
      scan,
      error,
    };
  }

  /** `deviceID` and, for a pair's master, the partners its card stands for. */
  function withPartners(deviceID: string): string[] {
    const record = records.get(deviceID);
    const pair = record && pairLedBy(record);
    return [
      deviceID,
      ...(pair ? partnersOf(pair) : []).filter((id) => records.has(id)),
    ];
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

  function update(deviceID: string, patch: Partial<SpeakerRecord>): void {
    const record = records.get(deviceID);
    if (record) {
      records.set(deviceID, { ...record, ...patch });
      changed();
    }
  }

  /** Stores the speaker's presets on our server when it uses ours and they changed. */
  function syncPresets(deviceID: string, state: SpeakerState): void {
    const accountId = state.margeAccountUUID;
    const ourServer = deps.ourServer.url();
    if (
      !state.presets ||
      !accountId ||
      !isSameOrigin(state.margeURL, ourServer)
    ) {
      return;
    }
    const sent = `${ourServer} ${accountId} ${JSON.stringify(state.presets)}`;
    if (syncedPresets.get(deviceID) === sent) {
      return;
    }
    syncedPresets.set(deviceID, sent);
    deps.ourServer
      .syncPresets(accountId, deviceID, state.presets)
      .catch((err: unknown) => {
        syncedPresets.delete(deviceID);
        deps.log.warn("[speakers] Could not sync presets:", err);
      });
  }

  function publish(deviceID: string, state: SpeakerState): void {
    if (state.connectionState === "disconnected") {
      // The live connection dropped, possibly before it first opened. The
      // client retries on its own and sends a state again once it's back;
      // until then commands can't reach it.
      const status = records.get(deviceID)?.status;
      if (status !== undefined && status !== "offline") {
        update(deviceID, { status: "offline", live: undefined });
      }
      return;
    }
    syncPresets(deviceID, state);
    const record = records.get(deviceID);
    if (record) {
      // Unread (another model, or `/getGroup` didn't answer): the
      // remembered pair stands.
      const pair =
        state.group === undefined
          ? record.pair
          : state.group
            ? pairFromGroup(state.group)
            : undefined;
      // For diagnostics: the master went to `GROUP_ERROR` (its partner is
      // gone; it goes to standby soon), or came back from it.
      const wasError = record.live?.group?.status === "GROUP_ERROR";
      const isError = state.group?.status === "GROUP_ERROR";
      if (state.group !== undefined && wasError !== isError) {
        deps.log.warn(
          isError
            ? `[speakers] ${deviceID} reports its stereo partner unreachable`
            : `[speakers] ${deviceID} reaches its stereo partner again`,
        );
      }
      update(deviceID, {
        status: "online",
        live: state,
        name: filled(state.name, record.name),
        type: filled(state.type, record.type),
        pair,
      });
      // It left the pair (or is in another): the other speaker, while it
      // can't say so itself, no longer remembers that pair either.
      const former = record.pair;
      if (former !== undefined && pair?.id !== former.id) {
        for (const { deviceID: other } of former.roles) {
          const otherRecord = records.get(other);
          if (
            other !== deviceID &&
            otherRecord?.status !== "online" &&
            otherRecord?.pair?.id === former.id
          ) {
            update(other, { pair: undefined });
          }
        }
      }
    }
    // A speaker set up for another server reports its new address; the
    // radio checked for the old one no longer holds.
    const checkedFor = radioCheckedFor.get(deviceID);
    if (
      checkedFor !== undefined &&
      state.margeURL &&
      state.margeURL !== checkedFor
    ) {
      void checkRadio(deviceID);
    }
  }

  /** Starts a radio check: any earlier one for the speaker no longer applies. */
  function startRadioCheck(deviceID: string): number {
    const check = (radioChecks.get(deviceID) ?? 0) + 1;
    radioChecks.set(deviceID, check);
    update(deviceID, { radioFailed: false });
    return check;
  }

  /** Checks how the speaker gets radio; `info` saves reading its `/info` again. */
  async function checkRadio(
    deviceID: string,
    info?: SpeakerInfo,
  ): Promise<void> {
    const record = records.get(deviceID);
    if (!record) {
      return;
    }
    const check = startRadioCheck(deviceID);
    const { host, port } = record;
    let radio: SpeakerRadio | undefined;
    try {
      const read = info ?? (await deps.speaker.info(host, port));
      if (read) {
        radioCheckedFor.set(deviceID, read.margeURL);
      }
      radio =
        read &&
        (await deps.speaker.radio(
          {
            host,
            port,
            margeURL: read.margeURL,
            margeAccountUUID: read.margeAccountUUID,
          },
          deps.ourServer.url(),
        ));
    } catch (err) {
      deps.log.warn(
        `[speakers] Could not check the radio of ${deviceID}:`,
        err,
      );
    }
    if (radioChecks.get(deviceID) !== check) {
      return;
    }
    update(
      deviceID,
      radio ? { radio, radioFailed: false } : { radioFailed: true },
    );
  }

  /**
   * Reaches the speaker answering at `address` and keeps it connected. With
   * `expectedDeviceID` (a remembered speaker), another device at that address
   * is ignored. Resolves to whether the speaker answered.
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

    const record = records.get(deviceID);
    records.set(deviceID, {
      deviceID,
      name: filled(info.name, record?.name ?? "Bose Speaker"),
      type: filled(info.type, record?.type ?? "SoundTouch"),
      host: address,
      port,
      status: record?.status ?? "connecting",
      radio: record?.radio,
      radioFailed: record?.radioFailed ?? false,
      live: record?.live,
      pair: record?.pair,
    });
    changed();

    const link: SpeakerLink = deps.speaker.link(address, port, deviceID, {
      onState: (state) => {
        if (links.get(deviceID) === link) {
          publish(deviceID, state);
        }
      },
      onSettingsChange: () => {
        if (links.get(deviceID) === link) {
          void checkRadio(deviceID);
        }
      },
    });
    links.set(deviceID, link);
    void checkRadio(deviceID, info);
    const state = await link.open();
    if (links.get(deviceID) === link) {
      publish(deviceID, state);
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
      update(deviceID, { status: "offline", live: undefined });
    }
  }

  /**
   * Reconnects a reached speaker and checks its radio again, or shows it
   * offline if it no longer answers; it's then reached again like a
   * remembered one.
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
      void checkRadio(deviceID, info);
      return;
    }
    links.delete(deviceID);
    link.close();
    update(deviceID, { status: "offline", live: undefined });
  }

  /** Checks again how every reached speaker gets radio. */
  function checkReachedRadio(): void {
    for (const record of records.values()) {
      if (record.status === "online") {
        void checkRadio(record.deviceID);
      }
    }
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
            records.set(entry.deviceID, {
              ...entry,
              status: "connecting",
              radioFailed: false,
            });
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

    /**
     * A scan the user asked for: runs its full length to find new speakers,
     * and checks the reached ones' radio again.
     */
    rescan: (): void => {
      startScan("user");
      checkReachedRadio();
    },

    /**
     * An offline speaker, tried again: at its last address and by scanning.
     * A pair's card tries both of its speakers.
     */
    retry: (deviceID: string): void => {
      let tried = false;
      for (const id of withPartners(deviceID)) {
        const record = records.get(id);
        if (record && record.status !== "online") {
          tried = true;
          update(id, { status: "connecting" });
          void reachRemembered(id);
        }
      }
      if (tried) {
        startScan("auto");
      }
    },

    /**
     * Stops listing a speaker and remembering it, until a scan finds it
     * again; a pair's card forgets both of its speakers.
     */
    forget: (deviceID: string): void => {
      let forgot = false;
      for (const id of withPartners(deviceID)) {
        forgetCount += 1;
        forgottenAt.set(id, forgetCount);
        const link = links.get(id);
        links.delete(id);
        link?.close();
        // Bumped, not reset, so a check still running can't pass for a later one.
        radioChecks.set(id, (radioChecks.get(id) ?? 0) + 1);
        radioCheckedFor.delete(id);
        syncedPresets.delete(id);
        forgot = records.delete(id) || forgot;
      }
      if (forgot) {
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

    /**
     * Checks again how a listed speaker gets radio, from the `/info` it
     * answers at `host` (its last address by default, else where it was
     * found, e.g. after a setup restarted it). Another device answering
     * there counts as no answer.
     */
    refreshRadio: async (deviceID: string, host?: string): Promise<void> => {
      const record = records.get(deviceID);
      if (!record) {
        return;
      }
      const address = host ?? record.host;
      const check = startRadioCheck(deviceID);
      const info = await deps.speaker.info(address, record.port);
      const current = records.get(deviceID);
      if (!current || radioChecks.get(deviceID) !== check) {
        return;
      }
      if (info?.deviceID !== deviceID) {
        update(deviceID, { radioFailed: true });
        return;
      }
      records.set(deviceID, {
        ...current,
        host: address,
        live: current.live && { ...current.live, margeURL: info.margeURL },
      });
      changed();
      await checkRadio(deviceID, info);
    },

    /**
     * Our server changed: shows every listed speaker's radio judged against
     * it, and checks again how the reached ones get radio.
     */
    refreshAllRadio: (): void => {
      changed();
      checkReachedRadio();
    },

    /** Shows a volume the user just set, before the speaker confirms it. */
    showVolume: (deviceID: string, volume: number): void => {
      const live = records.get(deviceID)?.live;
      if (live) {
        update(deviceID, { live: { ...live, volume } });
      }
    },
  };
}
