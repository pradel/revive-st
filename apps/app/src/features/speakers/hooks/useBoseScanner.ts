import type {
  AudioDspControlsResponse,
  AudioProductLevelControlsResponse,
  AudioProductToneControlsResponse,
  BassCapabilitiesResponse,
  CapabilitiesResponse,
  Preset,
} from "bose-api-speaker-client";
import {
  BoseWebSocketClient,
  boseSpeakerClient as createClient,
  escapeXml,
  KeyValue,
} from "bose-api-speaker-client";
import { useEffect, useState, useRef, useCallback } from "react";
import Zeroconf, { ZeroconfService } from "react-native-zeroconf";

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
  const k = key as (typeof KeyValue)[keyof typeof KeyValue];
  const client = createClient({ ip: host });
  let result = await client.pressKey({
    key: k,
    state: "press",
    sender: "Gabbo",
  });
  if (!result.isOk()) throw result.error;
  result = await client.pressKey({
    key: k,
    state: "release",
    sender: "Gabbo",
  });
  if (!result.isOk()) throw result.error;
}

async function longPress(host: string, key: string, durationMs = 2000) {
  const k = key as (typeof KeyValue)[keyof typeof KeyValue];
  const client = createClient({ ip: host });
  let result = await client.pressKey({
    key: k,
    state: "press",
    sender: "Gabbo",
  });
  if (!result.isOk()) throw result.error;
  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
  result = await client.pressKey({
    key: k,
    state: "release",
    sender: "Gabbo",
  });
  if (!result.isOk()) throw result.error;
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
      } catch (e) {
        console.warn("[BoseScanner] Error stopping zeroconf:", e);
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
        client.getNowPlaying().then((r) => (r.isOk() ? r.value : null)),
        client.getVolume().then((r) => (r.isOk() ? r.value : null)),
        hasPresetsLoaded
          ? client.getPresets().then((r) => (r.isOk() ? r.value : null))
          : Promise.resolve(null),
        hasBassLoaded
          ? client.getBass().then((r) => (r.isOk() ? r.value : null))
          : Promise.resolve(null),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getBassCapabilities()
              .then((r) => (r.isOk() ? r.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client.getCapabilities().then((r) => (r.isOk() ? r.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getAudioDspControls()
              .then((r) => (r.isOk() ? r.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getAudioProductToneControls()
              .then((r) => (r.isOk() ? r.value : null)),
        hasCapsLoaded
          ? Promise.resolve(null)
          : client
              .getAudioProductLevelControls()
              .then((r) => (r.isOk() ? r.value : null)),
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
              artUrl: nowPlaying?.art?.url ?? s.artUrl,
              volume: volumeInfo?.actualvolume ?? s.volume,
              muteEnabled: volumeInfo?.muteenabled ?? s.muteEnabled,
              presets: presetsResult ? presetsResult.presets : s.presets,
              bass: bassResult ? bassResult.actualbass : s.bass,
              bassCapabilities: bassCaps ?? s.bassCapabilities,
              capabilities: capabilities ?? s.capabilities,
              audioDspControls: dspControls ?? s.audioDspControls,
              audioProductToneControls:
                toneControls ?? s.audioProductToneControls,
              audioProductLevelControls:
                levelControls ?? s.audioProductLevelControls,
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

  useEffect(() => {
    const currentDeviceIds = new Set(speakers.map((s) => s.deviceID));

    const hasDeviceChange =
      currentDeviceIds.size !== prevDeviceIdsRef.current.size ||
      ![...currentDeviceIds].every((id) => prevDeviceIdsRef.current.has(id));

    if (!hasDeviceChange) return;

    prevDeviceIdsRef.current = currentDeviceIds;

    wsClientsRef.current.forEach((client, deviceID) => {
      if (!currentDeviceIds.has(deviceID)) {
        console.log(
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
      if (!service.host) return;

      try {
        const client = createClient({ ip: service.host });
        const infoResult = await client.getInfo();
        if (!infoResult.isOk()) return;
        const info = infoResult.value;
        if (!info.deviceID) return;

        const [
          nowPlaying,
          volumeInfo,
          bassCaps,
          capabilities,
          dspControls,
          toneControls,
          levelControls,
        ] = await Promise.all([
          client.getNowPlaying().then((r) => (r.isOk() ? r.value : null)),
          client.getVolume().then((r) => (r.isOk() ? r.value : null)),
          client.getBassCapabilities().then((r) => (r.isOk() ? r.value : null)),
          client.getCapabilities().then((r) => (r.isOk() ? r.value : null)),
          client.getAudioDspControls().then((r) => (r.isOk() ? r.value : null)),
          client
            .getAudioProductToneControls()
            .then((r) => (r.isOk() ? r.value : null)),
          client
            .getAudioProductLevelControls()
            .then((r) => (r.isOk() ? r.value : null)),
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
            artUrl: nowPlaying?.art?.url,
            volume: volumeInfo?.actualvolume,
            muteEnabled: volumeInfo?.muteenabled,
            bassCapabilities: bassCaps,
            capabilities: capabilities,
            audioDspControls: dspControls,
            audioProductToneControls: toneControls,
            audioProductLevelControls: levelControls,
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
        await pressAndRelease(speaker.host, "POWER");
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

      setSpeakers((prev) =>
        prev.map((s) => (s.deviceID === deviceID ? { ...s, volume: vol } : s)),
      );

      try {
        const client = createClient({ ip: speaker.host });
        const result = await client.setVolume({ volume: vol });
        if (!result.isOk()) throw result.error;
      } catch (err) {
        console.error(
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
      const speaker = speakersRef.current.find((s) => s.deviceID === deviceID);
      if (!speaker) return;

      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, isUpdating: true } : s,
        ),
      );

      try {
        await pressAndRelease(speaker.host, "PLAY_PAUSE");
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
        await pressAndRelease(speaker.host, key);
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
        const client = createClient({ ip: speaker.host });
        const result = await client.selectSource({
          source,
          sourceAccount: sourceAccount || undefined,
        });
        if (!result.isOk()) throw result.error;
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
      const client = createClient({ ip: speaker.host });
      const result = await client.getPresets();
      if (!result.isOk() || !isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, presets: result.value.presets } : s,
        ),
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
      const client = createClient({ ip: speaker.host });
      const result = await client.getBass();
      if (!result.isOk() || !isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID ? { ...s, bass: result.value.actualbass } : s,
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
      await longPress(speaker.host, `PRESET_${presetId}`);
      const client = createClient({ ip: speaker.host });
      const result = await client.getPresets();
      if (!isMounted.current) return;
      setSpeakers((prev) =>
        prev.map((s) =>
          s.deviceID === deviceID
            ? {
                ...s,
                presets: result.isOk() ? result.value.presets : s.presets,
                isUpdating: false,
              }
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
      const client = createClient({ ip: speaker.host });
      const result = await client.setBass(value);
      if (!result.isOk()) throw result.error;
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
        await playUri(speaker.host, uri, name);
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

  useEffect(() => {
    isMounted.current = true;
    startScan();

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
