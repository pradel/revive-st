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
} from "bose-api-speaker-client";
import { useEffect, useState, useRef, useCallback } from "react";
import Zeroconf, { type ZeroconfService } from "react-native-zeroconf";

import { logger } from "@/lib/logger";

import { syncPresetsToMarge } from "../lib/marge-api";
import { buildMargeRadioPayload } from "../lib/radio";

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
  components?: DeviceComponent[];
  macAddress?: string;
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
  };
}

export function useBoseScanner(scanDurationMs = 5000) {
  const [speakersData, setSpeakersData] = useState<Record<string, BoseSpeaker>>(
    {},
  );
  const [isScanning, setIsScanning] = useState(false);
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
      setIsScanning(false);
    }
  }, []);

  const refreshSpeakerStatus = useCallback(async (speakerInfo: BoseSpeaker) => {
    const speaker = speakersMapRef.current.get(speakerInfo.deviceID);
    if (speaker) {
      await speaker.initialize();
    }
  }, []);

  const startScan = useCallback(() => {
    stopScan();
    if (!isMounted.current) {
      return;
    }

    setIsScanning(true);
    setError(null);

    const zeroconf = new Zeroconf();
    zeroconfRef.current = zeroconf;

    zeroconf.on("resolved", (service: ZeroconfService) => {
      void (async () => {
        if (!isMounted.current) {
          return;
        }
        if (!service.host) {
          return;
        }

        try {
          const httpAdapter = new BoseHttpAdapter({
            ip: service.host,
            port: service.port || 8090,
          });
          const infoResult = await httpAdapter.getInfo();
          if (!isMounted.current) {
            return;
          }
          if (!infoResult.isOk()) {
            return;
          }
          const info = infoResult.value;
          if (!info.deviceID) {
            return;
          }

          const deviceID = info.deviceID;

          let speaker = speakersMapRef.current.get(deviceID);
          if (speaker) {
            const currentIp = speaker.options.ip;
            const currentPort = speaker.options.port;
            if (
              currentIp !== service.host ||
              currentPort !== (service.port || 8090) ||
              speaker.getState().connectionState === "disconnected"
            ) {
              speaker.disconnect();
              speaker = undefined;
            }
          }

          if (!speaker) {
            speaker = new Speaker({
              ip: service.host,
              port: service.port || 8090,
              deviceID,
              onStateUpdate: (state) => {
                if (!isMounted.current) {
                  return;
                }

                if (state.presets) {
                  syncPresetsToMarge(deviceID, state.presets).catch(
                    (err: unknown) => {
                      logger.warn(
                        "[useBoseScanner] Error syncing presets:",
                        err,
                      );
                    },
                  );
                }

                setSpeakersData((prev) => ({
                  ...prev,
                  [deviceID]: flattenSpeakerState(
                    deviceID,
                    service.host,
                    service.port || 8090,
                    isUpdatingRef.current[deviceID] ?? false,
                    state,
                  ),
                }));
              },
            });
            speakersMapRef.current.set(deviceID, speaker);

            // Connect to WebSocket and fetch initial state
            speaker.connect();
            await speaker.initialize();
          }
        } catch (err) {
          logger.log(
            `[BoseScanner] Device found at ${service.host} but failed info verification:`,
            err,
          );
        }
      })();
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

  const togglePower = useCallback(async (deviceID: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (!speaker) {
      return;
    }

    setUpdating(deviceID, true);
    try {
      const res = await speaker.powerToggle();
      if (res.isOk()) {
        setTimeout(() => {
          void speaker.initialize();
        }, 800);
      } else {
        logger.error(
          `[BoseScanner] Failed to toggle power on ${deviceID}:`,
          res.error,
        );
      }
    } finally {
      setUpdating(deviceID, false);
    }
  }, []);

  const changeVolume = useCallback(async (deviceID: string, vol: number) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (!speaker) {
      return;
    }

    setSpeakersData((prev) =>
      prev[deviceID]
        ? { ...prev, [deviceID]: { ...prev[deviceID], volume: vol } }
        : prev,
    );

    try {
      const res = await speaker.setVolume(vol);
      if (!res.isOk()) {
        logger.error(
          `[BoseScanner] Failed to set volume on ${deviceID}:`,
          res.error,
        );
        void speaker.initialize();
      }
    } finally {
      // Intentionally kept finally to match style if we add more state handling
    }
  }, []);

  const playPause = useCallback(async (deviceID: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (!speaker) {
      return;
    }

    setUpdating(deviceID, true);
    try {
      const res = await speaker.playPause();
      if (res.isOk()) {
        setTimeout(() => {
          void speaker.initialize();
        }, 500);
      } else {
        logger.error(
          `[BoseScanner] Failed to send play/pause to ${deviceID}:`,
          res.error,
        );
      }
    } finally {
      setUpdating(deviceID, false);
    }
  }, []);

  const triggerKey = useCallback(async (deviceID: string, key: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (!speaker) {
      return;
    }

    setUpdating(deviceID, true);
    try {
      const res = await speaker.triggerKey(key as any);
      if (res.isOk()) {
        setTimeout(() => {
          void speaker.initialize();
        }, 500);
      } else {
        logger.error(
          `[BoseScanner] Failed to send key ${key} to ${deviceID}:`,
          res.error,
        );
      }
    } finally {
      setUpdating(deviceID, false);
    }
  }, []);

  const selectSource = useCallback(
    async (deviceID: string, source: string, sourceAccount = "") => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        return;
      }

      setUpdating(deviceID, true);
      try {
        const res = await speaker.selectSource(
          source,
          sourceAccount || undefined,
        );
        if (res.isOk()) {
          setTimeout(() => {
            void speaker.initialize();
          }, 500);
        } else {
          logger.error(
            `[BoseScanner] Failed to select source ${source} on ${deviceID}:`,
            res.error,
          );
        }
      } finally {
        setUpdating(deviceID, false);
      }
    },
    [],
  );

  const loadPresets = useCallback(async (deviceID: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (speaker) {
      await speaker.initialize();
    } // Initialize pulls everything including presets
  }, []);

  const loadBass = useCallback(async (deviceID: string) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (speaker) {
      await speaker.initialize();
    }
  }, []);

  const savePreset = useCallback(async (deviceID: string, presetId: number) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (!speaker) {
      return;
    }

    if (
      presetId !== 1 &&
      presetId !== 2 &&
      presetId !== 3 &&
      presetId !== 4 &&
      presetId !== 5 &&
      presetId !== 6
    ) {
      logger.warn(
        `[BoseScanner] Invalid preset ID ${presetId} for ${deviceID}`,
      );
      return;
    }

    setUpdating(deviceID, true);
    try {
      const res = await speaker.savePreset(presetId);
      if (res.isOk()) {
        void speaker.initialize();
      } else {
        logger.error(
          `[BoseScanner] Failed to save preset ${presetId} on ${deviceID}:`,
          res.error,
        );
      }
    } finally {
      setUpdating(deviceID, false);
    }
  }, []);

  const setBass = useCallback(async (deviceID: string, value: number) => {
    const speaker = speakersMapRef.current.get(deviceID);
    if (!speaker) {
      return;
    }

    setUpdating(deviceID, true);
    try {
      const res = await speaker.setBass(value);
      if (res.isOk()) {
        void speaker.initialize();
      } else {
        logger.error(
          `[BoseScanner] Failed to set bass on ${deviceID}:`,
          res.error,
        );
      }
    } finally {
      setUpdating(deviceID, false);
    }
  }, []);

  const playStream = useCallback(
    async (deviceID: string, options: { uri: string; name: string }) => {
      const { uri, name } = options;
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        return;
      }

      setUpdating(deviceID, true);
      try {
        const payload = buildMargeRadioPayload(uri, name);
        // Fallback to manual HTTP request for custom Marge radio payload
        // Alternatively, we could add this custom playStream to Speaker module.
        // For now, doing it here since buildMargeRadioPayload is in apps/app
        const speakerIp = speaker.options.ip;
        const speakerPort = speaker.options.port ?? 8090;

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

        setTimeout(async () => speaker.initialize(), 1500);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger.error(
            `[useBoseScanner] Stream play request timed out for ${deviceID}`,
          );
        } else {
          logger.error(
            `[useBoseScanner] Failed to play stream on ${deviceID}:`,
            err,
          );
        }
        throw err;
      } finally {
        setUpdating(deviceID, false);
      }
    },
    [],
  );

  useEffect(() => {
    isMounted.current = true;
    startScan();

    const wsClients = speakersMapRef.current;

    return () => {
      isMounted.current = false;
      stopScan();
      wsClients.forEach((client) => {
        client.disconnect();
      });
      wsClients.clear();
    };
  }, [startScan, stopScan]);

  return {
    speakers: Object.values(speakersData),
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
