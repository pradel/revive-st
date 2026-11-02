import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { appVersion } from "@/lib/app-version";
import { logger } from "@/lib/logger";

import {
  DEFAULT_SERVER_URL,
  isSafeServerUrl,
  parseServerUrl,
} from "./server-url";
import {
  checkServerStatus,
  MIN_SERVER_VERSION,
  oldRelease,
  type ServerCheck,
} from "./server-version";

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
 * Names this build to the server, which counts the app versions still in use
 * to tell when an old one can be dropped.
 */
const APP_HEADERS = {
  "X-Revive-App-Version": appVersion,
  "X-Revive-App-Platform": Platform.OS,
};

/** `fetch` for a Revive ST server: the request names this build. */
export async function serverFetch(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(APP_HEADERS)) {
    headers.set(name, value);
  }
  return fetch(url, { ...init, headers });
}

/**
 * What the server at `url` says about itself at `GET /`: whether it's a
 * Revive ST server, and one this app works with. Throws when it can't be
 * reached, and once `signal` aborts.
 */
export async function fetchServerCheck(
  url: string,
  signal?: AbortSignal,
): Promise<ServerCheck> {
  const response = await serverFetch(`${url}/`, { signal });
  if (!response.ok) {
    return { kind: "notRevive" };
  }
  return checkServerStatus(await response.json().catch(() => null));
}

const NOT_REVIVE = "That server doesn't look like a Revive ST server.";

/**
 * Checks that a Revive ST server this app works with answers at `url`, and
 * that its speaker registry, which the speakers fetch first, lists the BMX
 * services. Returns the problem, if any.
 */
export async function checkServer(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, CHECK_TIMEOUT_MS);
  try {
    const check = await fetchServerCheck(url, controller.signal);
    if (check.kind === "notRevive") {
      return NOT_REVIVE;
    }
    if (check.kind === "tooOld") {
      return `That server runs ${oldRelease(check.version)}, and this app needs ${MIN_SERVER_VERSION} or newer. Update the server, then try again.`;
    }
    const response = await serverFetch(`${url}/v2/registry.json`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return `The server answered ${response.status}. Is it a Revive ST server?`;
    }
    const body = (await response.json().catch(() => null)) as {
      bmx_services?: unknown;
    } | null;
    return Array.isArray(body?.bmx_services) ? undefined : NOT_REVIVE;
  } catch (error) {
    logger.warn("[server] Could not reach", url, error);
    return controller.signal.aborted
      ? "The server took too long to answer."
      : "Couldn't reach the server. Check the address and that your phone can reach it.";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Switches to the Revive ST server at `input`, as the user typed it, once it
 * answers as one this app works with. Throws the problem to show: a malformed
 * address or a server that doesn't answer like ours.
 */
export async function switchServer(input: string): Promise<void> {
  const parsed = parseServerUrl(input.trim());
  if (!parsed.isOk()) {
    throw new Error(parsed.error);
  }
  const problem = await checkServer(parsed.value);
  if (problem !== undefined) {
    throw new Error(problem);
  }
  await saveServerUrl(parsed.value);
}
