import {
  BoseWebSocketClient,
  boseSpeakerClient as createClient,
  escapeXml,
  KeyValue,
  type AudioDspControlsResponse,
  type AudioProductLevelControlsResponse,
  type AudioProductToneControlsResponse,
  type BassCapabilitiesResponse,
  type CapabilitiesResponse,
  type Preset,
} from "bose-api-speaker-client";
import { useEffect, useState, useRef, useCallback } from "react";
import Zeroconf, { ZeroconfService } from "react-native-zeroconf";

import { logger } from "@/lib/logger";

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
  presets?: Preset[];
  bass?: number;
  bassCapabilities?: BassCapabilitiesResponse | null;
  capabilities?: CapabilitiesResponse | null;
  audioDspControls?: AudioDspControlsResponse | null;
  audioProductToneControls?: AudioProductToneControlsResponse | null;
  audioProductLevelControls?: AudioProductLevelControlsResponse | null;
}

async function pressAndRelease(host: string, key: string) {
  const keyValue = key as (typeof KeyValue)[keyof typeof KeyValue];
  const client = createClient({ ip: host });
  let result = await client.pressKey({
    key: keyValue,
    state: "press",
    sender: "Gabbo",
  });
  if (!result.isOk()) {
    throw result.error;
  }
  result = await client.pressKey({
    key: keyValue,
    state: "release",
    sender: "Gabbo",
  });
  if (!result.isOk()) {
    throw result.error;
  }
}

async function longPress(host: string, key: string, durationMs = 2000) {
  const keyValue = key as (typeof KeyValue)[keyof typeof KeyValue];
  const client = createClient({ ip: host });
  let result = await client.pressKey({
    key: keyValue,
    state: "press",
    sender: "Gabbo",
  });
  if (!result.isOk()) {
    throw result.error;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
  result = await client.pressKey({
    key: keyValue,
    state: "release",
    sender: "Gabbo",
  });
  if (!result.isOk()) {
    throw result.error;
  }
}

function playUri(host: string, uri: string, name: string) {
  const payload = `<ContentItem source="INTERNET_RADIO" location="${escapeXml(uri)}" sourceAccount=""><itemName>${escapeXml(name)}</itemName></ContentItem>`;
  return fetch(`http://${host}:8090/select`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: payload,
  });
}

export function useBoseScanner(scanDurationMs = 5000) {
  const [speakers, setSpeakers] = useState<BoseSpeaker[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zeroconfRef = useRef<Zeroconf | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  const speakersRef = useRef<BoseSpeaker[]>([]);
  speakersRef.current = speakers;

  const prevDeviceIdsRef = useRef<Set<string>>(new Set());

  const wsClientsRef = useRef<Map<string, BoseWebSocketClient>>(new Map());

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
      setIsScanning(false);
    }
  }, []);

  const refreshSpeakerStatus = useCallback(async (speaker: BoseSpeaker) => {
    try {
      const hasPresetsLoaded = speaker.presets !== undefined;
      const hasBassLoaded = speaker.bass !== undefined;
      const hasCapsLoaded = speaker.capabilities !== undefined;
      const client = createClient({ ip: speaker.host });

      const [
        nowPlaying,
        volumeInfo,
        presetsResult,
        bassResult,
        bassCaps,
        capabilities,
        dspControls,
        toneControls,
        levelControls,
      ] = await Promise.all([
        client.getNowPlaying().then((res) => (res.isOk() ? res.value : null)),
        client.getVolume().then((res) => (res.isOk() ? res.value : null)),
        hasPresetsLoaded
          ? client.getPresets().then((res) => (res.isOk() ? res.value : null))
          : Promise.resolve(null),
        hasBassLoaded
          ? client.getBass().then((res) => (res.isOk() ? res.value : null))
          : Promise.resolve(null),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getBassCapabilities()
              .then((res) => (res.isOk() ? res.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getCapabilities()
              .then((res) => (res.isOk() ? res.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getAudioDspControls()
              .then((res) => (res.isOk() ? res.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getAudioProductToneControls()
              .then((res) => (res.isOk() ? res.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getAudioProductLevelControls()
              .then((res) => (res.isOk() ? res.value : null)),
      ]);

      if (!isMounted.current) {
        return;
      }

      setSpeakers((prev) =>
        prev.map((item) => {
          if (item.deviceID === speaker.deviceID) {
            return {
              ...item,
              playStatus: nowPlaying?.playStatus ?? item.playStatus,
              source: nowPlaying?.source ?? item.source,
              track: nowPlaying?.track ?? item.track,
              artist: nowPlaying?.artist ?? item.artist,
              album: nowPlaying?.album ?? item.album,
              artUrl: nowPlaying?.art?.url ?? item.artUrl,
              volume: volumeInfo?.actualvolume ?? item.volume,
              muteEnabled: volumeInfo?.muteenabled ?? item.muteEnabled,
              presets: presetsResult ? presetsResult.presets : item.presets,
              bass: bassResult ? bassResult.actualbass : item.bass,
              bassCapabilities: bassCaps ?? item.bassCapabilities,
              capabilities: capabilities ?? item.capabilities,
              audioDspControls: dspControls ?? item.audioDspControls,
              audioProductToneControls:
                toneControls ?? item.audioProductToneControls,
              audioProductLevelControls:
                levelControls ?? item.audioProductLevelControls,
            };
          }
          return item;
        }),
      );
    } catch (err) {
      logger.warn(
        `[BoseScanner] Failed to refresh speaker ${speaker.name}:`,
        err,
      );
    }
  }, []);

  useEffect(() => {
    const currentDeviceIds = new Set(speakers.map((item) => item.deviceID));

    const hasDeviceChange =
      currentDeviceIds.size !== prevDeviceIdsRef.current.size ||
      ![...currentDeviceIds].every((id) => prevDeviceIdsRef.current.has(id));

    if (!hasDeviceChange) {
      return;
    }

    prevDeviceIdsRef.current = currentDeviceIds;

    wsClientsRef.current.forEach((client, deviceID) => {
      if (!currentDeviceIds.has(deviceID)) {
        logger.log(
          `[useBoseScanner] Stopping WebSocket client for lost device: ${deviceID}`,
        );
        client.close();
        wsClientsRef.current.delete(deviceID);
      }
    });

    speakers.forEach((speaker) => {
      if (!wsClientsRef.current.has(speaker.deviceID)) {
        const client = new BoseWebSocketClient({
          host: speaker.host,
          deviceID: speaker.deviceID,
          onUpdate: (update) => {
            if (!isMounted.current) {
              return;
            }

            logger.log(
              `[useBoseScanner] Received WebSocket notification (${update.type}) for ${update.deviceID}`,
            );

            const refreshIfAvailable = () => {
              const latest = speakersRef.current.find(
                (item) => item.deviceID === update.deviceID,
              );
              if (latest) {
                void refreshSpeakerStatus(latest);
              }
            };

            if (update.type === "volume") {
              if (update.volume) {
                setSpeakers((prev) =>
                  prev.map((item) => {
                    if (item.deviceID === update.deviceID) {
                      return {
                        ...item,
                        volume: update.volume!.actualVolume,
                        muteEnabled: update.volume!.muteEnabled,
                      };
                    }
                    return item;
                  }),
                );
              } else {
                refreshIfAvailable();
              }
            } else if (update.type === "nowPlaying") {
              if (update.nowPlaying) {
                setSpeakers((prev) =>
                  prev.map((item) => {
                    if (item.deviceID === update.deviceID) {
                      return {
                        ...item,
                        playStatus: update.nowPlaying!.playStatus,
                        source: update.nowPlaying!.source,
                        track: update.nowPlaying!.track,
                        artist: update.nowPlaying!.artist,
                        album: update.nowPlaying!.album,
                        artUrl: update.nowPlaying!.artUrl,
                      };
                    }
                    return item;
                  }),
                );
              } else {
                refreshIfAvailable();
              }
            } else if (update.type === "connectionState") {
              // handled by the parser, no state update needed
            } else {
              refreshIfAvailable();
            }
          },
          onDisconnect: () => {
            logger.log(
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
    if (!isMounted.current) {
      return;
    }

    setIsScanning(true);
    setError(null);

    const zeroconf = new Zeroconf();
    zeroconfRef.current = zeroconf;

    zeroconf.on("resolved", async (service: ZeroconfService) => {
      if (!isMounted.current) {
        return;
      }
      if (!service.host) {
        return;
      }

      try {
        const client = createClient({ ip: service.host });
        const infoResult = await client.getInfo();
        if (!infoResult.isOk()) {
          return;
        }
        const info = infoResult.value;
        if (!info.deviceID) {
          return;
        }

        const [
          nowPlaying,
          volumeInfo,
          bassCaps,
          capabilities,
          dspControls,
          toneControls,
          levelControls,
        ] = await Promise.all([
          client.getNowPlaying().then((res) => (res.isOk() ? res.value : null)),
          client.getVolume().then((res) => (res.isOk() ? res.value : null)),
          client
            .getBassCapabilities()
            .then((res) => (res.isOk() ? res.value : null)),
          client
            .getCapabilities()
            .then((res) => (res.isOk() ? res.value : null)),
          client
            .getAudioDspControls()
            .then((res) => (res.isOk() ? res.value : null)),
          client
            .getAudioProductToneControls()
            .then((res) => (res.isOk() ? res.value : null)),
          client
            .getAudioProductLevelControls()
            .then((res) => (res.isOk() ? res.value : null)),
        ]);

        if (!isMounted.current) {
          return;
        }

        setSpeakers((prev) => {
          const exists = prev.some((item) => item.deviceID === info.deviceID);
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
            artUrl: nowPlaying?.art?.url,
            volume: volumeInfo?.actualvolume,
            muteEnabled: volumeInfo?.muteenabled,
            bassCapabilities: bassCaps,
            capabilities,
            audioDspControls: dspControls,
            audioProductToneControls: toneControls,
            audioProductLevelControls: levelControls,
          };

          if (exists) {
            return prev.map((item) =>
              item.deviceID === info.deviceID ? newSpeaker : item,
            );
          } else {
            return [...prev, newSpeaker];
          }
        });
      } catch (err) {
        logger.log(
          `[BoseScanner] Device found at ${service.host} but failed info verification:`,
          err,
        );
      }
    });

    zeroconf.on("error", (err: unknown) => {
      logger.error("[BoseScanner] Zeroconf error:", err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setIsScanning(false);
      }
    });

    try {
      zeroconf.scan("soundtouch", "tcp", "local.");
    } catch (err) {
      logger.error("[BoseScanner] Scan exception:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsScanning(false);
    }

    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
    }, scanDurationMs);
  }, [scanDurationMs, stopScan]);

  const togglePower = useCallback(
    async (deviceID: string) => {
      const speaker = speakersRef.current.find(
        (item) => item.deviceID === deviceID,
      );
      if (!speaker) {
        return;
      }

      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
        ),
      );

      try {
        await pressAndRelease(speaker.host, "POWER");
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 800);
      } catch (err) {
        logger.error(
          `[BoseScanner] Failed to toggle power on ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const changeVolume = useCallback(
    async (deviceID: string, vol: number) => {
      const speaker = speakersRef.current.find(
        (item) => item.deviceID === deviceID,
      );
      if (!speaker) {
        return;
      }

      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, volume: vol } : item,
        ),
      );

      try {
        const client = createClient({ ip: speaker.host });
        const result = await client.setVolume({ volume: vol });
        if (!result.isOk()) {
          throw result.error;
        }
      } catch (err) {
        logger.error(
          `[BoseScanner] Failed to set volume on ${speaker.name}:`,
          err,
        );
        void refreshSpeakerStatus(speaker);
      }
    },
    [refreshSpeakerStatus],
  );

  const playPause = useCallback(
    async (deviceID: string) => {
      const speaker = speakersRef.current.find(
        (item) => item.deviceID === deviceID,
      );
      if (!speaker) {
        return;
      }

      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
        ),
      );

      try {
        await pressAndRelease(speaker.host, "PLAY_PAUSE");
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 500);
      } catch (err) {
        logger.error(
          `[BoseScanner] Failed to send play/pause to ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const triggerKey = useCallback(
    async (deviceID: string, key: string) => {
      const speaker = speakersRef.current.find(
        (item) => item.deviceID === deviceID,
      );
      if (!speaker) {
        return;
      }

      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
        ),
      );

      try {
        await pressAndRelease(speaker.host, key);
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 500);
      } catch (err) {
        logger.error(
          `[BoseScanner] Failed to send key ${key} to ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const selectSource = useCallback(
    async (deviceID: string, source: string, sourceAccount = "") => {
      const speaker = speakersRef.current.find(
        (item) => item.deviceID === deviceID,
      );
      if (!speaker) {
        return;
      }

      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
        ),
      );

      try {
        const client = createClient({ ip: speaker.host });
        const result = await client.selectSource({
          source,
          sourceAccount: sourceAccount || undefined,
        });
        if (!result.isOk()) {
          throw result.error;
        }
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 500);
      } catch (err) {
        logger.error(
          `[BoseScanner] Failed to select source ${source} on ${speaker.name}:`,
          err,
        );
      } finally {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  const loadPresets = useCallback(async (deviceID: string) => {
    const speaker = speakersRef.current.find(
      (item) => item.deviceID === deviceID,
    );
    if (!speaker) {
      return;
    }
    try {
      const client = createClient({ ip: speaker.host });
      const result = await client.getPresets();
      if (!result.isOk() || !isMounted.current) {
        return;
      }
      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID
            ? { ...item, presets: result.value.presets }
            : item,
        ),
      );
    } catch (err) {
      logger.warn(
        `[useBoseScanner] Failed to load presets for ${speaker.name}:`,
        err,
      );
    }
  }, []);

  const loadBass = useCallback(async (deviceID: string) => {
    const speaker = speakersRef.current.find(
      (item) => item.deviceID === deviceID,
    );
    if (!speaker) {
      return;
    }
    try {
      const client = createClient({ ip: speaker.host });
      const result = await client.getBass();
      if (!result.isOk() || !isMounted.current) {
        return;
      }
      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID
            ? { ...item, bass: result.value.actualbass }
            : item,
        ),
      );
    } catch (err) {
      logger.warn(
        `[useBoseScanner] Failed to load bass for ${speaker.name}:`,
        err,
      );
    }
  }, []);

  const savePreset = useCallback(async (deviceID: string, presetId: number) => {
    const speaker = speakersRef.current.find(
      (item) => item.deviceID === deviceID,
    );
    if (!speaker) {
      return;
    }
    try {
      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
        ),
      );
      await longPress(speaker.host, `PRESET_${presetId}`);
      const client = createClient({ ip: speaker.host });
      const result = await client.getPresets();
      if (!isMounted.current) {
        return;
      }
      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID
            ? {
                ...item,
                presets: result.isOk() ? result.value.presets : item.presets,
                isUpdating: false,
              }
            : item,
        ),
      );
    } catch (err) {
      if (isMounted.current) {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
      logger.warn(
        `[useBoseScanner] Failed to save preset for ${speaker.name}:`,
        err,
      );
      throw err;
    }
  }, []);

  const setBass = useCallback(async (deviceID: string, value: number) => {
    const speaker = speakersRef.current.find(
      (item) => item.deviceID === deviceID,
    );
    if (!speaker) {
      return;
    }
    try {
      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
        ),
      );
      const client = createClient({ ip: speaker.host });
      const result = await client.setBass(value);
      if (!result.isOk()) {
        throw result.error;
      }
      if (!isMounted.current) {
        return;
      }
      setSpeakers((prev) =>
        prev.map((item) =>
          item.deviceID === deviceID
            ? { ...item, bass: value, isUpdating: false }
            : item,
        ),
      );
    } catch (err) {
      if (isMounted.current) {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
      logger.warn(
        `[useBoseScanner] Failed to set bass for ${speaker.name}:`,
        err,
      );
      throw err;
    }
  }, []);

  const playStream = useCallback(
    async (deviceID: string, uri: string, name: string) => {
      const speaker = speakersRef.current.find(
        (item) => item.deviceID === deviceID,
      );
      if (!speaker) {
        return;
      }
      try {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: true } : item,
          ),
        );
        await playUri(speaker.host, uri, name);
        setTimeout(() => {
          void refreshSpeakerStatus(speaker);
        }, 1000);
      } catch (err) {
        logger.warn(
          `[useBoseScanner] Failed to play stream on ${speaker.name}:`,
          err,
        );
        throw err;
      } finally {
        setSpeakers((prev) =>
          prev.map((item) =>
            item.deviceID === deviceID ? { ...item, isUpdating: false } : item,
          ),
        );
      }
    },
    [refreshSpeakerStatus],
  );

  useEffect(() => {
    isMounted.current = true;
    startScan();

    pollIntervalRef.current = setInterval(() => {
      speakersRef.current.forEach((speaker) => {
        void refreshSpeakerStatus(speaker);
      });
    }, 15000);

    const wsClients = wsClientsRef.current;

    return () => {
      isMounted.current = false;
      stopScan();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      wsClients.forEach((client) => {
        client.close();
      });
      wsClients.clear();
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
