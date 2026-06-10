import { useCallback, useEffect, useRef } from "react";
import Zeroconf from "react-native-zeroconf";

import { logger } from "@/lib/logger";

interface DiscoveryResult {
  host: string;
  port: number;
  name: string;
}

interface UseSpeakerDiscoveryOptions {
  timeoutMs: number;
  ssid?: string;
  onDiscovered: (result: DiscoveryResult) => void;
  onTimeout: () => void;
  onError: (error: Error) => void;
}

export function extractSpeakerMacSuffix(ssid: string): string | null {
  const parenMatch = /\((.*?)\)/.exec(ssid);
  if (parenMatch?.[1]) {
    return parenMatch[1].trim().toLowerCase();
  }
  const words = ssid.split(/[\s-_]+/);
  for (const word of words) {
    const cleanWord = word.replace(/[^a-fA-F0-9]/g, "");
    if (cleanWord.length === 6 || cleanWord.length === 12) {
      return cleanWord.toLowerCase();
    }
  }
  return null;
}

export function useSpeakerDiscovery({
  timeoutMs,
  ssid,
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

    const expectedMacSuffix = ssid ? extractSpeakerMacSuffix(ssid) : null;
    if (ssid) {
      logger.log(
        `[Speaker Discovery] Starting discovery for speaker with SSID "${ssid}" (expected MAC suffix: ${expectedMacSuffix ?? "any"})`,
      );
    } else {
      logger.log(
        "[Speaker Discovery] Starting discovery for any SoundTouch speaker",
      );
    }

    zeroconf.on("resolved", (service) => {
      const cleanName = service.name?.toLowerCase() || "";
      const isMatch =
        !expectedMacSuffix || cleanName.includes(expectedMacSuffix);

      if (service.name?.includes("SoundTouch") && isMatch) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        zeroconf.stop();
        onDiscovered({
          host: service.host,
          port: service.port,
          name: service.name,
        });
      } else if (service.name?.includes("SoundTouch")) {
        logger.log(
          `[Speaker Discovery] Ignored speaker "${service.name}" (${service.host}) because it does not match expected MAC suffix "${expectedMacSuffix}"`,
        );
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
  }, [ssid, timeoutMs, onDiscovered, onTimeout, onError, stop]);

  useEffect(() => stop, [stop]);

  return { start, stop };
}
