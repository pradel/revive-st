import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Speaker,
  BoseHttpAdapter,
  type SpeakerState,
  type Preset,
  type BassCapabilitiesResponse,
  type CapabilitiesResponse,
  type AudioDspControlsResponse,
  type AudioProductToneControlsResponse,
  type AudioProductLevelControlsResponse,
  type DeviceComponent,
  type KeyValue,
  type AudioMode,
  contentItemXml,
} from "bose-api-speaker-client";
import { useEffect, useState, useRef, useCallback } from "react";
import { AppState } from "react-native";
import Zeroconf, { type Service } from "react-native-zeroconf";

import { useServerUrl } from "@/features/server/server";
import { logger } from "@/lib/logger";

import type { KnownSpeaker } from "../lib/known-speakers";
import {
  loadKnownSpeakers,
  saveKnownSpeakers,
} from "../lib/known-speakers-store";
import { syncPresetsToMarge, usesOurServer } from "../lib/marge-api";
import {
  confirmStationPlaying,
  stationContentItem,
  type CastStation,
} from "../lib/radio";
import { isSetUpForRadio } from "../lib/radio-setup";

/**
 * `connecting`: a remembered speaker shown from storage while the app tries
 * to reach it; `online`: reached, its state is live; `offline`: it didn't
 * answer at its last address and the network scan hasn't found it.
 */
export type SpeakerStatus = "connecting" | "online" | "offline";

export interface BoseSpeaker {
  deviceID: string;
  status: SpeakerStatus;
  host: string;
  port: number;
  name: string;
  type: string;
  playStatus?: string;
  source?: string;
  track?: string;
  artist?: string;
  album?: string;
  artUrl?: string;
  volume?: number;
  muteEnabled?: boolean;
  isUpdating?: boolean;
  presets?: Preset[];
  bass?: number;
  bassCapabilities?: BassCapabilitiesResponse | null;
  capabilities?: CapabilitiesResponse | null;
  audioDspControls?: AudioDspControlsResponse | null;
  audioProductToneControls?: AudioProductToneControlsResponse | null;
  audioProductLevelControls?: AudioProductLevelControlsResponse | null;
  components?: DeviceComponent[];
  macAddress?: string;
  /** The Marge account the speaker is paired with; empty when unpaired. */
  margeAccountUUID?: string;
  /** The Marge server the speaker calls. */
  margeURL?: string;
}

function flattenSpeakerState(
  deviceID: string,
  host: string,
  port: number,
  isUpdating: boolean,
  state: SpeakerState,
): BoseSpeaker {
  return {
    deviceID,
    status: "online",
    host,
    port,
    name: state.name ?? "Bose Speaker",
    type: state.type ?? "SoundTouch",
    playStatus: state.nowPlaying?.playStatus,
    source: state.nowPlaying?.source,
    track: state.nowPlaying?.track,
    artist: state.nowPlaying?.artist,
    album: state.nowPlaying?.album,
    artUrl: state.nowPlaying?.artUrl,
    volume: state.volume,
    muteEnabled: state.isMuted,
    isUpdating,
    presets: state.presets,
    bass: state.bass,
    bassCapabilities: state.bassCapabilities,
    capabilities: state.capabilities,
    audioDspControls: state.audioDspControls,
    audioProductToneControls: state.audioProductToneControls,
    audioProductLevelControls: state.audioProductLevelControls,
    components: state.components,
    macAddress: state.macAddress,
    margeAccountUUID: state.margeAccountUUID,
    margeURL: state.margeURL,
  };
}

/**
 * How long a rename may take. The speaker normally answers within a second;
 * it only takes longer while its Marge server fails.
 */
const RENAME_TIMEOUT_MS = 15_000;

/** How long one readback of what a speaker plays may take while starting a station. */
const READBACK_TIMEOUT_MS = 2000;

/** How long a speaker may take to answer `/info` before it counts as offline. */
const PROBE_TIMEOUT_MS = 4000;

/** A remembered speaker's card until the app reaches it. */
function rememberedSpeaker(
  known: KnownSpeaker,
  status: SpeakerStatus,
): BoseSpeaker {
  return {
    deviceID: known.deviceID,
    status,
    host: known.host,
    port: known.port,
    name: known.name,
    type: known.type,
  };
}

/** Who started a scan: the app (launch, return to foreground) or the user. */
type ScanKind = "auto" | "user";

export function useSpeakerManager({
  enabled = true,
  scanDurationMs = 5000,
}: {
  /** Looks for and connects to speakers only once true (see `local-network`). */
  enabled?: boolean;
  scanDurationMs?: number;
} = {}) {
  const [speakersData, setSpeakersData] = useState<Record<string, BoseSpeaker>>(
    {},
  );
  const [scan, setScan] = useState<ScanKind | null>(null);
  /** The remembered speakers are loaded and listed. */
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zeroconfRef = useRef<Zeroconf | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const speakersMapRef = useRef<Map<string, Speaker>>(new Map());
  const isUpdatingRef = useRef<Record<string, boolean>>({});

  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (zeroconfRef.current) {
      try {
        zeroconfRef.current.stop();
        zeroconfRef.current.removeDeviceListeners();
      } catch (err) {
        logger.warn("[BoseScanner] Error stopping zeroconf:", err);
      }
      zeroconfRef.current = null;
    }
    if (isMounted.current) {
      setScan(null);
    }
  }, []);

  const refreshSpeakerStatus = useCallback(async (speakerInfo: BoseSpeaker) => {
    const speaker = speakersMapRef.current.get(speakerInfo.deviceID);
    if (speaker) {
      await speaker.initialize();
    }
  }, []);

  /**
   * Reaches the speaker answering at `address` and keeps it connected: its
   * card shows once its state is loaded, not before. With `expectedDeviceID`
   * (a remembered speaker), another device at that address is ignored.
   * Resolves to whether the speaker answered.
   */
  const connectAt = useCallback(
    async (address: string, port: number, expectedDeviceID?: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, PROBE_TIMEOUT_MS);
      const infoResult = await new BoseHttpAdapter({ ip: address, port })
        .getInfo({ signal: controller.signal })
        .finally(() => {
          clearTimeout(timer);
        });
      if (!isMounted.current || !infoResult.isOk()) {
        return false;
      }
      const deviceID = infoResult.value.deviceID;
      if (
        !deviceID ||
        (expectedDeviceID !== undefined && deviceID !== expectedDeviceID)
      ) {
        return false;
      }

      const existing = speakersMapRef.current.get(deviceID);
      if (
        existing?.options.ip === address &&
        existing.options.port === port &&
        existing.getState().connectionState !== "disconnected"
      ) {
        return true;
      }
      existing?.disconnect();

      // The speaker emits state while connecting, before `initialize` has
      // read anything; its card waits for the first full state instead of
      // showing an empty one.
      let ready = false;
      const publish = (state: SpeakerState) => {
        const accountId = state.margeAccountUUID;
        if (state.presets && accountId && usesOurServer(state.margeURL)) {
          syncPresetsToMarge(accountId, deviceID, state.presets).catch(
            (err: unknown) => {
              logger.warn("[useBoseScanner] Error syncing presets:", err);
            },
          );
        }
        setSpeakersData((prev) => ({
          ...prev,
          [deviceID]: flattenSpeakerState(
            deviceID,
            address,
            port,
            isUpdatingRef.current[deviceID] ?? false,
            state,
          ),
        }));
      };
      const speaker = new Speaker({
        ip: address,
        port,
        deviceID,
        onStateUpdate: (state) => {
          if (isMounted.current && ready) {
            publish(state);
          }
        },
      });
      speakersMapRef.current.set(deviceID, speaker);

      // Connect to WebSocket and fetch initial state
      speaker.connect();
      await speaker.initialize();
      if (
        !isMounted.current ||
        speakersMapRef.current.get(deviceID) !== speaker
      ) {
        return true;
      }
      ready = true;
      publish(speaker.getState());
      return true;
    },
    [],
  );

  /** Tries a remembered speaker at its last address; offline if it doesn't answer. */
  const reachRemembered = useCallback(
    async (deviceID: string, host: string, port: number) => {
      const answered = await connectAt(host, port, deviceID).catch(
        (err: unknown) => {
          logger.log(
            `[BoseScanner] ${deviceID} didn't answer at ${host}:`,
            err,
          );
          return false;
        },
      );
      if (answered || !isMounted.current) {
        return;
      }
      setSpeakersData((prev) => {
        const entry = prev[deviceID];
        if (!entry || entry.status === "online") {
          return prev;
        }
        return { ...prev, [deviceID]: { ...entry, status: "offline" } };
      });
    },
    [connectAt],
  );

  const startScan = useCallback(
    (kind: ScanKind) => {
      stopScan();
      if (!isMounted.current) {
        return;
      }

      setScan(kind);
      setError(null);

      const zeroconf = new Zeroconf();
      zeroconfRef.current = zeroconf;

      zeroconf.on("resolved", (service: Service) => {
        if (!isMounted.current) {
          return;
        }
        // Since react-native-zeroconf 0.17, `host` is the mDNS hostname on Android 16+;
        // prefer the resolved IPv4 address.
        const address = service.ipv4[0] ?? service.host;
        if (!address) {
          return;
        }
        connectAt(address, service.port || 8090).catch((err: unknown) => {
          logger.log(
            `[BoseScanner] Device found at ${address} but failed info verification:`,
            err,
          );
        });
      });

      zeroconf.on("error", (err) => {
        // Per-service failures (e.g. resolve TIMEOUT) are non-fatal; the scan keeps running.
        if (err.serviceName) {
          logger.warn(
            `[BoseScanner] Ignoring non-fatal zeroconf error for "${err.serviceName}":`,
            err,
          );
          return;
        }
        logger.error("[BoseScanner] Zeroconf error:", err);
        if (isMounted.current) {
          setError(err.message);
          setScan(null);
        }
      });

      try {
        zeroconf.scan({
          type: "soundtouch",
          protocol: "tcp",
          domain: "local.",
        });
      } catch (err) {
        logger.error("[BoseScanner] Scan exception:", err);
        setError(err instanceof Error ? err.message : String(err));
        setScan(null);
      }

      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
      }, scanDurationMs);
    },
    [connectAt, scanDurationMs, stopScan],
  );

  /**
   * Reconnects every listed speaker (remembered ones at their last address)
   * and scans for the rest: on launch and when the app returns to the
   * foreground, where sockets may have been dropped while it was away.
   */
  const reconnectAll = useCallback(
    (entries: readonly BoseSpeaker[]) => {
      for (const entry of entries) {
        const speaker = speakersMapRef.current.get(entry.deviceID);
        if (speaker && entry.status === "online") {
          speaker.connect();
          void speaker.initialize();
        } else {
          void reachRemembered(entry.deviceID, entry.host, entry.port);
        }
      }
      startScan("auto");
    },
    [reachRemembered, startScan],
  );

  /** An offline speaker, tried again: at its last address and by scanning. */
  const retrySpeaker = useCallback(
    (entry: BoseSpeaker) => {
      if (entry.status === "online") {
        return;
      }
      setSpeakersData((prev) => ({
        ...prev,
        [entry.deviceID]: { ...entry, status: "connecting" },
      }));
      void reachRemembered(entry.deviceID, entry.host, entry.port);
      startScan("auto");
    },
    [reachRemembered, startScan],
  );

  /** Stops listing a speaker and remembering it, until the scan finds it again. */
  const forgetSpeaker = useCallback((deviceID: string) => {
    speakersMapRef.current.get(deviceID)?.disconnect();
    speakersMapRef.current.delete(deviceID);
    setSpeakersData((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => id !== deviceID),
      ),
    );
  }, []);

  const setUpdating = (deviceID: string, isUpdating: boolean) => {
    isUpdatingRef.current[deviceID] = isUpdating;
    setSpeakersData((prev) => {
      if (!prev[deviceID]) {
        return prev;
      }
      return {
        ...prev,
        [deviceID]: {
          ...prev[deviceID],
          isUpdating,
        },
      };
    });
  };

  const powerToggleMutation = useMutation({
    mutationFn: async ({ deviceID }: { deviceID: string }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        const res = await speaker.powerToggle();
        if (!res.isOk()) {
          void speaker.initialize();
          throw res.error;
        }
        setTimeout(() => {
          void speaker.initialize();
        }, 800);
      } finally {
        setUpdating(deviceID, false);
      }
    },
  });

  const volumeMutation = useMutation({
    mutationFn: async ({
      deviceID,
      volume,
    }: {
      deviceID: string;
      volume: number;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        setSpeakersData((prev) =>
          prev[deviceID]
            ? { ...prev, [deviceID]: { ...prev[deviceID], volume } }
            : prev,
        );
        const res = await speaker.setVolume(volume);
        if (!res.isOk()) {
          void speaker.initialize();
          throw res.error;
        }
      } finally {
        setUpdating(deviceID, false);
      }
    },
  });

  const playPauseMutation = useMutation({
    mutationFn: async ({ deviceID }: { deviceID: string }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        const res = await speaker.playPause();
        if (!res.isOk()) {
          void speaker.initialize();
          throw res.error;
        }
        setTimeout(() => {
          void speaker.initialize();
        }, 500);
      } finally {
        setUpdating(deviceID, false);
      }
    },
  });

  const keyMutation = useMutation({
    mutationFn: async ({
      deviceID,
      key,
    }: {
      deviceID: string;
      key: KeyValue;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        const res = await speaker.triggerKey(key);
        if (!res.isOk()) {
          void speaker.initialize();
          throw res.error;
        }
        setTimeout(() => {
          void speaker.initialize();
        }, 500);
      } finally {
        setUpdating(deviceID, false);
      }
    },
  });

  const selectSourceMutation = useMutation({
    mutationFn: async ({
      deviceID,
      source,
      sourceAccount,
    }: {
      deviceID: string;
      source: string;
      sourceAccount?: string;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        const res = await speaker.selectSource(
          source,
          sourceAccount ?? undefined,
        );
        if (!res.isOk()) {
          void speaker.initialize();
          throw res.error;
        }
        setTimeout(() => {
          void speaker.initialize();
        }, 500);
      } finally {
        setUpdating(deviceID, false);
      }
    },
  });

  const loadPresets = useCallback(async (deviceID: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (speaker) {
      await speaker.initialize();
    }
  }, []);

  const loadBass = useCallback(async (deviceID: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (speaker) {
      await speaker.initialize();
    }
  }, []);

  const savePresetMutation = useMutation({
    mutationFn: async ({
      deviceID,
      presetId,
    }: {
      deviceID: string;
      presetId: number;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      if (![1, 2, 3, 4, 5, 6].includes(presetId)) {
        throw new Error(`Invalid preset ID ${presetId}`);
      }
      setUpdating(deviceID, true);
      const res = await speaker.savePreset(presetId as any);
      setUpdating(deviceID, false);
      if (!res.isOk()) {
        throw res.error;
      }
      void speaker.initialize();
    },
  });

  const setBassMutation = useMutation({
    mutationFn: async ({
      deviceID,
      value,
    }: {
      deviceID: string;
      value: number;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      const res = await speaker.setBass(value);
      setUpdating(deviceID, false);
      if (!res.isOk()) {
        throw res.error;
      }
      void speaker.initialize();
    },
  });

  const storeStationPresetMutation = useMutation({
    mutationFn: async ({
      deviceID,
      presetId,
      station,
    }: {
      deviceID: string;
      presetId: 1 | 2 | 3 | 4 | 5 | 6;
      station: CastStation;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      const res = await speaker.storePreset(
        presetId,
        stationContentItem(station),
      );
      if (!res.isOk()) {
        throw res.error;
      }
      // Reloads the presets, which also stores them on our server.
      await speaker.initialize();
    },
  });

  const playStationMutation = useMutation({
    mutationFn: async ({
      deviceID,
      station,
    }: {
      deviceID: string;
      station: CastStation;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        const speakerIp = speaker.options.ip;
        const speakerPort = speaker.options.port ?? 8090;
        const contentItem = stationContentItem(station);
        const payload = contentItemXml(contentItem);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 5000);
        const response = await fetch(
          `http://${speakerIp}:${speakerPort}/select`,
          {
            method: "POST",
            headers: { "Content-Type": "text/xml" },
            body: payload,
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "No response body");
          if (
            errorText.includes('"1005"') ||
            errorText.includes("UNKNOWN_SOURCE_ERROR")
          ) {
            throw new Error("UNKNOWN_SOURCE_ERROR");
          }
          throw new Error(
            `Failed to play URI: ${response.status} ${response.statusText} - ${errorText}`,
          );
        }
        const http = new BoseHttpAdapter({
          ip: speakerIp,
          port: speakerPort,
        });
        await confirmStationPlaying(async () => {
          // A readback the speaker never answers counts as unanswered, so the
          // confirmation keeps to its schedule.
          const readController = new AbortController();
          const readTimeoutId = setTimeout(() => {
            readController.abort();
          }, READBACK_TIMEOUT_MS);
          try {
            const nowPlaying = await http.getNowPlaying({
              signal: readController.signal,
            });
            return nowPlaying.isOk() ? nowPlaying.value : null;
          } finally {
            clearTimeout(readTimeoutId);
          }
        }, contentItem.location);
      } finally {
        setUpdating(deviceID, false);
        void speaker.initialize();
      }
    },
  });

  const setNameMutation = useMutation({
    mutationFn: async ({
      deviceID,
      name,
    }: {
      deviceID: string;
      name: string;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      // A rename waits on the speaker's Marge server, and the speaker can hold
      // its reply while that server fails; give up instead of leaving
      // "Saving…" up forever.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, RENAME_TIMEOUT_MS);
      try {
        const res = await speaker.setName(name, { signal: controller.signal });
        if (!res.isOk()) {
          throw res.error;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });

  const setAudioDspControlsMutation = useMutation({
    mutationFn: async ({
      deviceID,
      audiomode,
    }: {
      deviceID: string;
      audiomode: AudioMode;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      const res = await speaker.setAudioDspControls(audiomode);
      if (!res.isOk()) {
        throw res.error;
      }
    },
  });

  const setAudioProductToneControlsMutation = useMutation({
    mutationFn: async ({
      deviceID,
      bass,
      treble,
    }: {
      deviceID: string;
      bass?: { value: number };
      treble?: { value: number };
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      const res = await speaker.setAudioProductToneControls({ bass, treble });
      if (!res.isOk()) {
        throw res.error;
      }
    },
  });

  const setAudioProductLevelControlsMutation = useMutation({
    mutationFn: async ({
      deviceID,
      frontCenterSpeakerLevel,
      rearSurroundSpeakersLevel,
    }: {
      deviceID: string;
      frontCenterSpeakerLevel?: { value: number };
      rearSurroundSpeakersLevel?: { value: number };
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      const res = await speaker.setAudioProductLevelControls({
        frontCenterSpeakerLevel,
        rearSurroundSpeakersLevel,
      });
      if (!res.isOk()) {
        throw res.error;
      }
    },
  });

  // Lists the remembered speakers before anything is reached.
  useEffect(() => {
    isMounted.current = true;
    void loadKnownSpeakers().then((known) => {
      if (!isMounted.current) {
        return;
      }
      setSpeakersData((prev) => ({
        ...Object.fromEntries(
          known.map((entry) => [
            entry.deviceID,
            rememberedSpeaker(entry, "connecting"),
          ]),
        ),
        ...prev,
      }));
      setRestored(true);
    });

    const wsClients = speakersMapRef.current;
    return () => {
      isMounted.current = false;
      stopScan();
      wsClients.forEach((client) => {
        client.disconnect();
      });
      wsClients.clear();
    };
  }, [stopScan]);

  const speakersDataRef = useRef(speakersData);
  useEffect(() => {
    speakersDataRef.current = speakersData;
  }, [speakersData]);

  // Reaches the remembered speakers and scans once allowed, then again each
  // time the app comes back from the background.
  useEffect(() => {
    if (!enabled || !restored) {
      return;
    }
    reconnectAll(Object.values(speakersDataRef.current));

    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      const wasInBackground = previous === "background";
      previous = next;
      if (next === "active" && wasInBackground) {
        reconnectAll(Object.values(speakersDataRef.current));
      }
    });
    return () => {
      subscription.remove();
    };
  }, [enabled, restored, reconnectAll]);

  // Remembers the listed speakers: reached ones with their current name and
  // address, the others as they were stored.
  const savedKnownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!restored) {
      return;
    }
    const known: KnownSpeaker[] = Object.values(speakersData).map(
      ({ deviceID, name, type, host, port }) => ({
        deviceID,
        name,
        type,
        host,
        port,
      }),
    );
    const serialized = JSON.stringify(known);
    if (savedKnownRef.current === null) {
      // The first list is what was just loaded.
      savedKnownRef.current = serialized;
      return;
    }
    if (serialized !== savedKnownRef.current) {
      savedKnownRef.current = serialized;
      void saveKnownSpeakers(known);
    }
  }, [restored, speakersData]);

  // An automatic scan ends once every listed speaker has answered; a scan the
  // user asked for runs its full length to find new speakers.
  useEffect(() => {
    const entries = Object.values(speakersData);
    if (
      scan === "auto" &&
      entries.length > 0 &&
      entries.every((entry) => entry.status === "online")
    ) {
      stopScan();
    }
  }, [scan, speakersData, stopScan]);

  const listedSpeakers = Object.values(speakersData);
  const rescan = useCallback(() => {
    startScan("user");
  }, [startScan]);

  return {
    /** Reached speakers, the ones commands go to. */
    speakers: listedSpeakers.filter((speaker) => speaker.status === "online"),
    /** Reached speakers and remembered ones still connecting or offline. */
    listedSpeakers,
    /** The remembered speakers are listed (the first screen can show). */
    restored,
    isScanning: scan !== null,
    /** A scan the user asked for (pull to refresh, "Scan again") is running. */
    isRefreshing: scan === "user",
    error,
    rescan,
    retrySpeaker,
    forgetSpeaker,
    refreshStatus: refreshSpeakerStatus,
    loadPresets,
    loadBass,
    powerToggleMutation,
    volumeMutation,
    playPauseMutation,
    keyMutation,
    selectSourceMutation,
    savePresetMutation,
    storeStationPresetMutation,
    setBassMutation,
    playStationMutation,
    setNameMutation,
    setAudioDspControlsMutation,
    setAudioProductToneControlsMutation,
    setAudioProductLevelControlsMutation,
  };
}

/** The speaker list's query key for `useRadioSetupQuery`, to refetch it. */
export const RADIO_SETUP_QUERY_KEY = "radio-setup";

/**
 * Whether the speaker at `host` is set up for internet radio on our server;
 * re-checked when the server changes.
 */
export function useRadioSetupQuery(host: string) {
  const serverUrl = useServerUrl();
  return useQuery({
    queryKey: [RADIO_SETUP_QUERY_KEY, host, serverUrl],
    queryFn: async () => isSetUpForRadio(host),
    enabled: host.length > 0,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
