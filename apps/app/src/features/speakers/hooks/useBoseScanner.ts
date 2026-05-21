import { useEffect, useState, useRef, useCallback } from "react";
import Zeroconf, { ZeroconfService } from "react-native-zeroconf";

import {
  fetchSpeakerInfo,
  fetchNowPlaying,
  fetchVolume,
  sendKeyCommand,
  setSpeakerVolume,
  BoseSpeakerInfo,
  selectSpeakerSource,
  BosePreset,
  fetchPresets,
  fetchSpeakerBass,
  setSpeakerBass,
  sendLongKeyCommand,
  playSpeakerUri,
} from "../utils/boseParser";
import { BoseWSClient } from "../utils/boseWebSocket";

export interface BoseSpeaker {
  deviceID: string;
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
  presets?: BosePreset[];
  bass?: number;
}

export function useBoseScanner(scanDurationMs = 5000) {
  const [speakers, setSpeakers] = useState<BoseSpeaker[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zeroconfRef = useRef<Zeroconf | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  // We keep a ref to speakers so our callbacks can reference the latest list without re-triggering effects
  const speakersRef = useRef<BoseSpeaker[]>([]);
  speakersRef.current = speakers;

  const wsClientsRef = useRef<Map<string, BoseWSClient>>(new Map());

  const stopScan = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (zeroconfRef.current) {
      try {
        zeroconfRef.current.stop();
      } catch (e) {
        console.warn("[BoseScanner] Error stopping zeroconf:", e);
      }
    }
    if (isMounted.current) {
      setIsScanning(false);
    }
  }, []);

  const refreshSpeakerStatus = useCallback(async (speaker: BoseSpeaker) => {
    try {
      const hasPresetsLoaded = speaker.presets !== undefined;
      const hasBassLoaded = speaker.bass !== undefined;

      const [nowPlaying, volumeInfo, presets, bassInfo] = await Promise.all([
        fetchNowPlaying(speaker.host).catch(() => null),
        fetchVolume(speaker.host).catch(() => null),
        hasPresetsLoaded
          ? fetchPresets(speaker.host).catch(() => null)
          : Promise.resolve(null),
        hasBassLoaded
          ? fetchSpeakerBass(speaker.host).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!isMounted.current) return;

      setSpeakers((prev) =>
        prev.map((s) => {
          if (s.deviceID === speaker.deviceID) {
            return {
              ...s,
              playStatus: nowPlaying?.playStatus ?? s.playStatus,
              source: nowPlaying?.source ?? s.source,
              track: nowPlaying?.track ?? s.track,
              artist: nowPlaying?.artist ?? s.artist,
              album: nowPlaying?.album ?? s.album,
              artUrl: nowPlaying?.artUrl ?? s.artUrl,
              volume: volumeInfo?.actualVolume ?? s.volume,
              muteEnabled: volumeInfo?.muteEnabled ?? s.muteEnabled,
              presets: presets ?? s.presets,
              bass: bassInfo ? bassInfo.actualBass : s.bass,
            };
          }
          return s;
        }),
      );
    } catch (err) {
      console.warn(
        `[BoseScanner] Failed to refresh speaker ${speaker.name}:`,
        err,
      );
    }
  }, []);

  // Manage WebSocket connections based on discovered speakers list
  useEffect(() => {
    const currentDeviceIds = new Set(speakers.map((s) => s.deviceID));

    // Close and remove clients for speakers that are no longer present
    wsClientsRef.current.forEach((client, deviceID) => {
      if (!currentDeviceIds.has(deviceID)) {
        console.log(
          `[useBoseScanner] Stopping WebSocket client for lost device: ${deviceID}`,
        );
        client.close();
        wsClientsRef.current.delete(deviceID);
      }
    });

    // Create and connect clients for new speakers
    speakers.forEach((speaker) => {
      if (!wsClientsRef.current.has(speaker.deviceID)) {
        const client = new BoseWSClient({
          host: speaker.host,
          deviceID: speaker.deviceID,
          onUpdate: (update) => {
            if (!isMounted.current) return;

            console.log(
              `[useBoseScanner] Received WebSocket notification (${update.type}) for ${update.deviceID}`,
            );

            if (update.volume || update.nowPlaying) {
              setSpeakers((prev) =>
                prev.map((s) => {
                  if (s.deviceID === update.deviceID) {
                    return {
                      ...s,
                      volume: update.volume
                        ? update.volume.actualVolume
                        : s.volume,
                      muteEnabled: update.volume
                        ? update.volume.muteEnabled
                        : s.muteEnabled,
                      playStatus: update.nowPlaying
                        ? update.nowPlaying.playStatus
                        : s.playStatus,
                      source: update.nowPlaying
                        ? update.nowPlaying.source
                        : s.source,
                      track: update.nowPlaying
                        ? update.nowPlaying.track
                        : s.track,
                      artist: update.nowPlaying
                        ? update.nowPlaying.artist
                        : s.artist,
                      album: update.nowPlaying
                        ? update.nowPlaying.album
                        : s.album,
                      artUrl: update.nowPlaying
                        ? update.nowPlaying.artUrl
                        : s.artUrl,
                    };
                  }
                  return s;
                }),
              );
            } else {
              // Notification signal with no payload, trigger REST API refresh
              const latestSpeaker = speakersRef.current.find(
                (s) => s.deviceID === update.deviceID,
              );
              if (latestSpeaker) {
                void refreshSpeakerStatus(latestSpeaker);
              }
            }
          },
          onDisconnect: () => {
            console.log(
              `[useBoseScanner] WebSocket disconnected for ${speaker.deviceID}`,
            );
          },
        });

        wsClientsRef.current.set(speaker.deviceID, client);
        client.connect();
      }
    });
  }, [speakers, refreshSpeakerStatus]);

  const startScan = useCallback(() => {
    stopScan();
    if (!isMounted.current) return;

    setIsScanning(true);
    setError(null);

    const zeroconf = new Zeroconf();
    zeroconfRef.current = zeroconf;

    zeroconf.on("resolved", async (service: ZeroconfService) => {
      if (!isMounted.current) return;

      // Ensure we only process services that belong to SoundTouch
      if (!service.host) return;

      try {
        // Query /info to confirm it's a Bose speaker and get its details
        const info: BoseSpeakerInfo = await fetchSpeakerInfo(service.host);

        if (!isMounted.current) return;
        if (!info.deviceID) return;

        // Fetch initial status
        const [nowPlaying, volumeInfo] = await Promise.all([
          fetchNowPlaying(service.host).catch(() => null),
          fetchVolume(service.host).catch(() => null),
        ]);

        if (!isMounted.current) return;

        setSpeakers((prev) => {
          const exists = prev.some((s) => s.deviceID === info.deviceID);
          const newSpeaker: BoseSpeaker = {
            deviceID: info.deviceID,
            host: service.host,
            port: service.port || 8090,
            name: info.name || service.name || "Bose Speaker",
            type: info.type || "SoundTouch",
            playStatus: nowPlaying?.playStatus,
            source: nowPlaying?.source,
            track: nowPlaying?.track,
            artist: nowPlaying?.artist,
            album: nowPlaying?.album,
            artUrl: nowPlaying?.artUrl,
            volume: volumeInfo?.actualVolume,
            muteEnabled: volumeInfo?.muteEnabled,
          };

          if (exists) {
            return prev.map((s) =>
              s.deviceID === info.deviceID ? newSpeaker : s,
            );
          } else {
            return [...prev, newSpeaker];
          }
        });
      } catch (err) {
        console.log(
          `[BoseScanner] Device found at ${service.host} but failed info verification:`,
          err,
        );
      }
    });

    zeroconf.on("error", (err: unknown) => {
      console.error("[BoseScanner] Zeroconf error:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setIsScanning(false);
      }
    });

    try {
      zeroconf.scan("soundtouch", "tcp", "local.");
    } catch (e) {
      console.error("[BoseScanner] Scan exception:", e);
      setError(e instanceof Error ? e.message : String(e));
      setIsScanning(false);
    }

    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
    }, scanDurationMs);
  }, [scanDurationMs, stopScan]);

  const togglePower = useCallback(
    async (deviceID: string) => {
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;

      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );

      try {
        await sendKeyCommand(speaker.host, "POWER");
        // Wait a short time for speaker state to transition, then refresh status
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 800);
      } catch (err) {
        console.error(
          `[BoseScanner] Failed to toggle power on ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const changeVolume = useCallback(
    async (deviceID: string, vol: number) => {
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;

      // Optimistically update volume in UI
      setSpeakers((prev) =>
        prev.map((s) => (s.deviceID === deviceID ? { ...s, volume: vol } : s)),
      );

      try {
        await setSpeakerVolume(speaker.host, vol);
      } catch (err) {
        console.error(
          `[BoseScanner] Failed to set volume on ${speaker.name}:`,
          err,
        );
        // Revert/refresh
        void refreshSpeakerStatus(speaker);
      }
    },
    [refreshSpeakerStatus],
  );

  const playPause = useCallback(
    async (deviceID: string) => {
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;

      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );

      try {
        await sendKeyCommand(speaker.host, "PLAY_PAUSE");
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 500);
      } catch (err) {
        console.error(
          `[BoseScanner] Failed to send play/pause to ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const triggerKey = useCallback(
    async (deviceID: string, key: string) => {
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;

      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );

      try {
        await sendKeyCommand(speaker.host, key);
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 500);
      } catch (err) {
        console.error(
          `[BoseScanner] Failed to send key ${key} to ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const selectSource = useCallback(
    async (deviceID: string, source: string, sourceAccount = "") => {
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;

      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );

      try {
        await selectSpeakerSource(speaker.host, source, sourceAccount);
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 500);
      } catch (err) {
        console.error(
          `[BoseScanner] Failed to select source ${source} on ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const loadPresets = useCallback(async (deviceID: string) => {
    const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
    if (!speaker) return;
    try {
      const presets = await fetchPresets(speaker.host);
      if (!isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) => (s.deviceID === deviceID ? { ...s, presets } : s)),
      );
    } catch (err) {
      console.warn(
        `[useBoseScanner] Failed to load presets for ${speaker.name}:`,
        err,
      );
    }
  }, []);

  const loadBass = useCallback(async (deviceID: string) => {
    const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
    if (!speaker) return;
    try {
      const bassInfo = await fetchSpeakerBass(speaker.host);
      if (!isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, bass: bassInfo.actualBass } : s,
        ),
      );
    } catch (err) {
      console.warn(
        `[useBoseScanner] Failed to load bass for ${speaker.name}:`,
        err,
      );
    }
  }, []);

  const savePreset = useCallback(async (deviceID: string, presetId: number) => {
    const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
    if (!speaker) return;
    try {
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );
      await sendLongKeyCommand(speaker.host, `PRESET_${presetId}`);
      const presets = await fetchPresets(speaker.host);
      if (!isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, presets, isUpdating: false } : s,
        ),
      );
    } catch (err) {
      if (isMounted.current) {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
      console.warn(
        `[useBoseScanner] Failed to save preset for ${speaker.name}:`,
        err,
      );
      throw err;
    }
  }, []);

  const setBass = useCallback(async (deviceID: string, value: number) => {
    const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
    if (!speaker) return;
    try {
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );
      await setSpeakerBass(speaker.host, value);
      if (!isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID
            ? { ...s, bass: value, isUpdating: false }
            : s,
        ),
      );
    } catch (err) {
      if (isMounted.current) {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
      console.warn(
        `[useBoseScanner] Failed to set bass for ${speaker.name}:`,
        err,
      );
      throw err;
    }
  }, []);

  const playStream = useCallback(
    async (deviceID: string, uri: string, name: string) => {
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;
      try {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
          ),
        );
        await playSpeakerUri(speaker.host, uri, name);
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 1000);
      } catch (err) {
        console.warn(
          `[useBoseScanner] Failed to play stream on ${speaker.name}:`,
          err,
        );
        throw err;
      } finally {
        setSpeakers((prev) =>
          prev.map((s) =>
            s.deviceID === deviceID ? { ...s, isUpdating: false } : s,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  // Start initial scan and polling loop
  useEffect(() => {
    isMounted.current = true;
    startScan();

    // Poll discovered speakers status every 15 seconds as a fallback
    pollIntervalRef.current = setInterval(() => {
      speakersRef.current.forEach((speaker) => {
        void refreshSpeakerStatus(speaker);
      });
    }, 15000);

    return () => {
      isMounted.current = false;
      stopScan();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Close all WebSocket clients on unmount
      wsClientsRef.current.forEach((client) => {
        client.close();
      });
      wsClientsRef.current.clear();
    };
  }, [startScan, stopScan, refreshSpeakerStatus]);

  return {
    speakers,
    isScanning,
    error,
    rescan: startScan,
    togglePower,
    changeVolume,
    playPause,
    triggerKey,
    selectSource,
    refreshStatus: refreshSpeakerStatus,
    loadPresets,
    loadBass,
    savePreset,
    setBass,
    playStream,
  };
}
