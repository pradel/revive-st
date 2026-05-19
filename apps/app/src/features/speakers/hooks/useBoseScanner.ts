import { useEffect, useState, useRef, useCallback } from "react";
import Zeroconf, { ZeroconfService } from "react-native-zeroconf";
import {
  fetchSpeakerInfo,
  fetchNowPlaying,
  fetchVolume,
  sendKeyCommand,
  setSpeakerVolume,
  BoseSpeakerInfo,
} from "../utils/boseParser";

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
      const [nowPlaying, volumeInfo] = await Promise.all([
        fetchNowPlaying(speaker.host).catch(() => null),
        fetchVolume(speaker.host).catch(() => null),
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

  // Start initial scan and polling loop
  useEffect(() => {
    isMounted.current = true;
    startScan();

    // Poll discovered speakers status every 4 seconds
    pollIntervalRef.current = setInterval(() => {
      speakersRef.current.forEach((speaker) => {
        void refreshSpeakerStatus(speaker);
      });
    }, 4000);

    return () => {
      isMounted.current = false;
      stopScan();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
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
    refreshStatus: refreshSpeakerStatus,
  };
}
