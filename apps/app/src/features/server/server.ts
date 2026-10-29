import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

import { logger } from "@/lib/logger";

import { DEFAULT_SERVER_URL, isSafeServerUrl } from "./server-url";

const SERVER_URL_KEY = "server_url";
const CHECK_TIMEOUT_MS = 8000;

let serverUrl = DEFAULT_SERVER_URL;
const listeners = new Set<() => void>();

function publish(url: string) {
  serverUrl = url;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * The origin of the Revive ST server the app talks to and configures
 * speakers for. Read it at the moment it's used: it changes when the user
 * picks another server.
 */
export const getServerUrl = () => serverUrl;

/** `getServerUrl`, re-rendering when the user picks another server. */
export function useServerUrl() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getServerUrl);
}

/** Loads the server the user picked; the default one until it's loaded. */
export async function loadServerUrl(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (stored !== null && isSafeServerUrl(stored)) {
      publish(stored);
    }
  } catch (error) {
    logger.warn("[server] Could not load the server address:", error);
  }
}

/** Switches to the server at `url`, an origin from `parseServerUrl`. */
export async function saveServerUrl(url: string): Promise<void> {
  if (!isSafeServerUrl(url)) {
    throw new Error(`Invalid server address: ${url}`);
  }
  await (url === DEFAULT_SERVER_URL
    ? AsyncStorage.removeItem(SERVER_URL_KEY)
    : AsyncStorage.setItem(SERVER_URL_KEY, url));
  publish(url);
}

/**
 * Checks that a Revive ST server answers at `url`: its speaker registry,
 * which the speakers fetch first, lists the BMX services. Returns the
 * problem, if any.
 */
export async function checkServer(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/v2/registry.json`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return `The server answered ${response.status}. Is it a Revive ST server?`;
    }
    const body = (await response.json().catch(() => null)) as {
      bmx_services?: unknown;
    } | null;
    return Array.isArray(body?.bmx_services)
      ? undefined
      : "That server doesn't look like a Revive ST server.";
  } catch (error) {
    logger.warn("[server] Could not reach", url, error);
    return controller.signal.aborted
      ? "The server took too long to answer."
      : "Couldn't reach the server. Check the address and that your phone can reach it.";
  } finally {
    clearTimeout(timer);
  }
}
