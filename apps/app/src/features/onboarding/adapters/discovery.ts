import Zeroconf, { type Service } from "react-native-zeroconf";

import { logger } from "@/lib/logger";

import type { DiscoveredService, Discovery } from "../session/ports";

const BROWSE_RESTART_MS = 30_000;

function toDiscovered(service: Service): DiscoveredService {
  const mac = service.txt?.MAC?.replace(/[^0-9a-f]/gi, "");
  return {
    // Since react-native-zeroconf 0.17, `host` is the mDNS hostname on Android 16+.
    host: service.ipv4[0] ?? service.host,
    port: service.port,
    mac: mac ? mac.toUpperCase() : null,
  };
}

async function* browse(signal: AbortSignal): AsyncGenerator<DiscoveredService> {
  if (signal.aborted) {
    return;
  }
  const zeroconf = new Zeroconf();
  const queue: DiscoveredService[] = [];
  let wake: (() => void) | null = null;
  const notify = () => {
    const resume = wake;
    wake = null;
    resume?.();
  };
  const nextEvent = async () => {
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  };
  const scan = () => {
    zeroconf.scan({ type: "soundtouch", protocol: "tcp", domain: "local." });
  };

  zeroconf.on("resolved", (service) => {
    queue.push(toDiscovered(service));
    notify();
  });
  zeroconf.on("error", (err) => {
    // Per-service failures (e.g. resolve TIMEOUT) are non-fatal. Browse-level
    // failures are retried by the periodic restart.
    if (!err.serviceName) {
      logger.log(`[Discovery] mDNS error: ${err.message}`);
    }
  });
  const restart = setInterval(() => {
    zeroconf.stop();
    scan();
  }, BROWSE_RESTART_MS);
  let stopped = false;
  // Runs on abort even if the consumer never resumes the iterator, and again
  // (as a no-op) from `finally`.
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(restart);
    signal.removeEventListener("abort", onAbort);
    zeroconf.stop();
    zeroconf.removeAllListeners();
    zeroconf.removeDeviceListeners();
  };
  const onAbort = () => {
    stop();
    notify();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  scan();

  try {
    while (!signal.aborted) {
      const next = queue.shift();
      if (next) {
        yield next;
      } else {
        await nextEvent();
      }
    }
  } finally {
    stop();
  }
}

export const zeroconfDiscovery: Discovery = { browse };
