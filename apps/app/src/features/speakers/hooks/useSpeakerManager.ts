import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  type SocketModuleLike,
  type KeyValue,
  type AudioMode,
} from "bose-api-speaker-client";
import { useEffect, useState, useRef, useCallback } from "react";
import TcpSocket from "react-native-tcp-socket";
import Zeroconf, { type ZeroconfService } from "react-native-zeroconf";

import { logger } from "@/lib/logger";

import { syncPresetsToMarge } from "../lib/marge-api";
import { buildMargeRadioPayload } from "../lib/radio";
import { checkMargeAPIStatus, configureMargeAPI } from "../lib/telnet";

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

export function useSpeakerManager(scanDurationMs = 5000) {
  const queryClient = useQueryClient();
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

  const playStreamMutation = useMutation({
    mutationFn: async ({
      deviceID,
      uri,
      name,
    }: {
      deviceID: string;
      uri: string;
      name: string;
    }) => {
      const speaker = speakersMapRef.current.get(deviceID);
      if (!speaker) {
        throw new Error("Speaker not connected");
      }
      setUpdating(deviceID, true);
      try {
        const payload = buildMargeRadioPayload(uri, name);
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
      } finally {
        setUpdating(deviceID, false);
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
      const res = await speaker.setName(name);
      if (!res.isOk()) {
        throw res.error;
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

  const configureMargeAPIMutation = useMutation({
    mutationFn: async ({ host }: { host: string }) => {
      const result = await configureMargeAPI(
        host,
        TcpSocket as unknown as SocketModuleLike,
      );
      if (!result.isOk()) {
        throw result.error;
      }
    },
    onSettled: (_data, err, { host }) => {
      if (!err) {
        queryClient.setQueryData(["marge-api-status", host], true);
      }
    },
  });
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
    refreshStatus: refreshSpeakerStatus,
    loadPresets,
    loadBass,
    powerToggleMutation,
    volumeMutation,
    playPauseMutation,
    keyMutation,
    selectSourceMutation,
    savePresetMutation,
    setBassMutation,
    playStreamMutation,
    setNameMutation,
    setAudioDspControlsMutation,
    setAudioProductToneControlsMutation,
    setAudioProductLevelControlsMutation,
    configureMargeAPIMutation,
  };
}

export function useMargeAPIStatusQuery(host: string) {
  return useQuery({
    queryKey: ["marge-api-status", host],
    queryFn: async () => checkMargeAPIStatus(host),
    enabled: host.length > 0,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
