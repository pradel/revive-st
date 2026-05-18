import { useEffect, useRef, useCallback } from "react";
import Zeroconf from "react-native-zeroconf";

interface DiscoveryResult {
  host: string;
  port: number;
  name: string;
}

interface UseSpeakerDiscoveryOptions {
  timeoutMs: number;
  onDiscovered: (result: DiscoveryResult) => void;
  onTimeout: () => void;
  onError: (error: Error) => void;
}

export function useSpeakerDiscovery({
  timeoutMs,
  onDiscovered,
  onTimeout,
  onError,
}: UseSpeakerDiscoveryOptions) {
  const zeroconfRef = useRef<Zeroconf | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (zeroconfRef.current) {
      zeroconfRef.current.stop();
    }
  }, []);

  const start = useCallback(() => {
    stop();

    const zeroconf = new Zeroconf();
    zeroconfRef.current = zeroconf;
    attemptsRef.current = 0;

    zeroconf.on("resolved", (service) => {
      if (service.name?.includes("SoundTouch")) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        zeroconf.stop();
        onDiscovered({
          host: service.host,
          port: service.port,
          name: service.name,
        });
      }
    });

    zeroconf.on("error", (err: unknown) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      zeroconf.stop();
      onError(err instanceof Error ? err : new Error(String(err)));
    });

    timerRef.current = setTimeout(() => {
      zeroconf.stop();
      onTimeout();
    }, timeoutMs);

    zeroconf.scan("soundtouch", "tcp", "local.");
  }, [timeoutMs, onDiscovered, onTimeout, onError, stop]);

  useEffect(() => {
    return stop;
  }, [stop]);

  return { start, stop };
}
