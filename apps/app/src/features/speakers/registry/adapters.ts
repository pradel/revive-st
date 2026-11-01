import { BoseHttpAdapter, Speaker } from "bose-api-speaker-client";
import Zeroconf, { type Service } from "react-native-zeroconf";

import { getServerUrl } from "@/features/server/server";
import { logger } from "@/lib/logger";

import {
  loadKnownSpeakers,
  saveKnownSpeakers,
} from "../lib/known-speakers-store";
import { syncPresetsToMarge } from "../lib/marge-api";
import type { SpeakerInfo, SpeakerRegistryDeps } from "./ports";

/** How long a speaker may take to answer `/info` before it counts as offline. */
const INFO_TIMEOUT_MS = 4000;

async function readInfo(
  host: string,
  port: number,
): Promise<SpeakerInfo | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, INFO_TIMEOUT_MS);
  try {
    const result = await new BoseHttpAdapter({ ip: host, port }).getInfo({
      signal: controller.signal,
    });
    if (result.isErr()) {
      return undefined;
    }
    const { deviceID, name, type } = result.value;
    return { deviceID, name, type };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** The speakers on the network, found over mDNS (`_soundtouch._tcp`). */
function startScanner(
  onFound: (host: string, port: number) => void,
  onError: (message: string) => void,
): () => void {
  const zeroconf = new Zeroconf();
  zeroconf.on("resolved", (service: Service) => {
    // Since react-native-zeroconf 0.17, `host` is the mDNS hostname on
    // Android 16+; prefer the resolved IPv4 address.
    const address = service.ipv4[0] ?? service.host;
    if (address) {
      onFound(address, service.port || 8090);
    }
  });
  zeroconf.on("error", (err) => {
    // Per-service failures (e.g. resolve TIMEOUT) are non-fatal; the scan keeps running.
    if (err.serviceName) {
      logger.warn(
        `[speakers] Ignoring a scan error for "${err.serviceName}":`,
        err,
      );
      return;
    }
    logger.error("[speakers] Scan error:", err);
    onError(err.message);
  });
  const stop = () => {
    try {
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
    } catch (err) {
      logger.warn("[speakers] Could not stop the scan:", err);
    }
  };
  try {
    zeroconf.scan({ type: "soundtouch", protocol: "tcp", domain: "local." });
  } catch (err) {
    stop();
    throw err;
  }
  return stop;
}

export function createSpeakerRegistryDeps(): SpeakerRegistryDeps {
  return {
    speaker: {
      info: readInfo,
      link: (host, port, deviceID, onState) => {
        // The speaker emits state while connecting, before `open` has read
        // anything, and when it's closed: neither is passed on.
        let open = false;
        const client = new Speaker({
          ip: host,
          port,
          deviceID,
          onStateUpdate: (state) => {
            if (open) {
              onState(state);
            }
          },
        });
        return {
          host,
          port,
          client,
          open: async () => {
            client.connect();
            await client.initialize();
            open = true;
            return client.getState();
          },
          isConnected: () =>
            client.getState().connectionState !== "disconnected",
          refresh: async () => {
            await client.initialize();
          },
          reconnect: () => {
            client.connect();
            void client.initialize();
          },
          close: () => {
            open = false;
            client.disconnect();
          },
        };
      },
    },
    scanner: { start: startScanner },
    storage: { load: loadKnownSpeakers, save: saveKnownSpeakers },
    ourServer: { url: getServerUrl, syncPresets: syncPresetsToMarge },
    later: (run, ms) => {
      const timer = setTimeout(run, ms);
      return () => {
        clearTimeout(timer);
      };
    },
    log: {
      warn: (message, error) => {
        logger.warn(message, error);
      },
    },
  };
}
