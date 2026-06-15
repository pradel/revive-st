import {
  ApiError,
  boseSpeakerClient,
  HttpError,
  NetworkError,
  XmlParseError,
} from "bose-api-speaker-client";
import {
  connectToOpenNetwork,
  disconnect as disconnectBose,
  isConnected,
} from "expo-bose-wifi";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import WifiManager from "react-native-wifi-reborn";

import { logger } from "@/lib/logger";

import { useProvisioning } from "../ProvisioningContext";
import {
  findSpeakerIP,
  isSpeakerHotspot,
  probeSpeakerIP,
  MDNS_DISCOVERY_TIMEOUT_MS,
} from "../utils/networkHelpers";
import { useSpeakerDiscovery } from "./useSpeakerDiscovery";

export function useWifiProvisioning() {
  const { state, dispatch } = useProvisioning();
  const scanningRef = useRef(false);
  const connectingRef = useRef(false);
  const sendingRef = useRef(false);
  const reconnectingRef = useRef(false);

  useEffect(() => {
    logger.log(`[Onboarding Flow] ➔ Transitioning to step: ${state.step}`);
  }, [state.step]);

  const scanForHotspot = useCallback(async () => {
    if (scanningRef.current) {
      logger.log("[WiFi Scan] Already scanning, skipping");
      return;
    }
    scanningRef.current = true;
    try {
      logger.log("[WiFi Scan] Starting active scan...");
      let rawNetworks: unknown;

      try {
        rawNetworks = await WifiManager.reScanAndLoadWifiList();
      } catch (scanErr) {
        logger.log("[WiFi Scan] Active scan failed/rejected:", scanErr);
      }

      if (!Array.isArray(rawNetworks)) {
        logger.log(
          `[WiFi Scan] Active scan returned non-array (${typeof rawNetworks}). Falling back to cached wifi list...`,
        );
        if (typeof rawNetworks === "string") {
          logger.log(`[WiFi Scan] Active scan warning: "${rawNetworks}"`);
        }
        try {
          rawNetworks = await WifiManager.loadWifiList();
        } catch (loadErr) {
          logger.log("[WiFi Scan] Failed to load cached wifi list:", loadErr);
        }
      }

      const isArr = Array.isArray(rawNetworks);
      if (isArr) {
        const networks = rawNetworks as {
          SSID: string;
          BSSID: string;
          level: number;
          capabilities: string;
        }[];

        const speakers = networks
          .filter((n) => n.SSID && isSpeakerHotspot(n.SSID))
          .map((n) => ({ ssid: n.SSID, bssid: n.BSSID }));

        logger.log(
          `[WiFi Scan] Scan complete. Found ${networks.length} networks. Matching Bose speakers: ${speakers.length}`,
        );

        if (speakers.length > 0) {
          dispatch({
            type: "SPEAKERS_FOUND",
            speakers,
          });
        } else {
          logger.log(
            "[WiFi Scan] No speaker hotspot found matching Bose ST/SoundTouch pattern",
          );
          dispatch({ type: "HOTSPOT_TIMEOUT" });
        }
      } else {
        logger.log("[WiFi Scan] networks is not an array, skipping parsing");
        dispatch({ type: "HOTSPOT_TIMEOUT" });
      }
    } catch (err) {
      logger.log("[WiFi Scan] Error:", err instanceof Error ? err.stack : err);
      dispatch({ type: "HOTSPOT_TIMEOUT" });
    } finally {
      scanningRef.current = false;
    }
  }, [dispatch]);

  const connectToHotspot = useCallback(
    async (ssid: string, bssid: string) => {
      if (connectingRef.current) {
        logger.log(
          "[WiFi Connect] Already connecting, skipping duplicate call",
        );
        return;
      }
      connectingRef.current = true;
      try {
        logger.log(
          `[WiFi Connect] Platform: ${Platform.OS} ${Platform.Version}`,
        );
        logger.log(`[WiFi Connect] Connecting to: "${ssid}" (${bssid})`);

        if (Platform.OS === "android") {
          logger.log("[WiFi Connect] Using native BoseWifi module");
          const result = await connectToOpenNetwork(ssid, bssid);
          logger.log(`[WiFi Connect] Native result: ${result.message}`);
          dispatch({
            type: "HOTSPOT_CONNECTED",
            ssid,
            bssid,
            speakerIP: result.ip,
          });
        } else {
          logger.log("[WiFi Connect] Using react-native-wifi-reborn (iOS)");
          await WifiManager.connectToProtectedSSIDPrefix(ssid, "", false);

          logger.log("[WiFi Connect] Connected, probing speaker IP...");
          const ip = await findSpeakerIP();
          if (ip) {
            logger.log(`[WiFi Connect] Speaker reachable at ${ip}`);
            dispatch({ type: "HOTSPOT_CONNECTED", ssid, bssid, speakerIP: ip });
          } else {
            logger.log(
              "[WiFi Connect] Connected to hotspot but speaker not reachable on any candidate IP",
            );
            dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
          }
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "timeoutOccurred") {
          logger.log(
            "[WiFi Connect] TIMEOUT: Connection did not complete within 180s",
          );
        } else {
          logger.log("[WiFi Connect] ERROR (not timeout):", e.code);
          logger.log("[WiFi Connect] Error message:", e.message);
        }
        logger.log(
          "[WiFi Connect] Full error:",
          JSON.stringify(err, Object.getOwnPropertyNames(err)),
        );
        dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
      } finally {
        connectingRef.current = false;
      }
    },
    [dispatch],
  );

  const sendCreds = useCallback(async () => {
    if (sendingRef.current) {
      return;
    }
    sendingRef.current = true;
    const s = state as {
      ssid: string;
      bssid: string;
      speakerIP: string;
      homeSSID: string;
      homePassword: string;
    };
    try {
      if (Platform.OS === "android") {
        const connected = await isConnected();
        logger.log(`[Send Creds] isConnected: ${connected}`);
        if (!connected) {
          logger.log(
            "[Send Creds] Reconnecting to Bose network before sending...",
          );
          await connectToOpenNetwork(s.ssid, s.bssid);
        }
      }
      const client = boseSpeakerClient({ ip: s.speakerIP });
      const result = await client.sendCredentials(s.homeSSID, s.homePassword);
      if (!result.isOk()) {
        const err = result.error;
        if (err instanceof NetworkError) {
          logger.log(
            `[Send Creds] NetworkError encountered. Treating as success (AP likely shut down by speaker)`,
          );
        } else {
          throw err;
        }
      }
      dispatch({ type: "CREDENTIALS_SENT" });
    } catch (err) {
      logger.log(
        "[Send Creds] Error: Failed to transmit Wi-Fi credentials to speaker. Transitioning to CREDENTIALS_FAILED.",
      );
      if (err instanceof ApiError) {
        logger.log("[Send Creds Hook] Error tag: ApiError");
        logger.log(`[Send Creds Hook] ApiError deviceID: ${err.deviceID}`);
        err.errors.forEach((e, i) => {
          logger.log(
            `[Send Creds Hook]   Error #${i + 1}: Name="${e.name}" Value=${e.value} Severity="${e.severity}" Message="${e.message}"`,
          );
        });
      } else if (err instanceof HttpError) {
        logger.log("[Send Creds Hook] Error tag: HttpError");
        logger.log(
          `[Send Creds Hook] HttpError Status: ${err.statusCode} ${err.statusText}`,
        );
        logger.log(`[Send Creds Hook] HttpError Body: ${err.body}`);
      } else if (err instanceof XmlParseError) {
        logger.log("[Send Creds Hook] Error tag: XmlParseError");
        logger.log(`[Send Creds Hook] XmlParseError Message: ${err.message}`);
        logger.log(`[Send Creds Hook] XmlParseError XML: ${err.rawXml}`);
      } else if (err instanceof NetworkError) {
        logger.log("[Send Creds Hook] Error tag: NetworkError");
        logger.log(`[Send Creds Hook] NetworkError Message: ${err.message}`);
      } else {
        logger.log(
          "[Send Creds Hook] Unknown error caught in sendCreds callback:",
          err instanceof Error ? err.stack : err,
        );
      }
      dispatch({ type: "CREDENTIALS_SEND_FAILED" });
    } finally {
      sendingRef.current = false;
    }
  }, [dispatch, state]);

  const reconnectPhone = useCallback(
    async (ssid?: string) => {
      if (reconnectingRef.current) {
        return;
      }
      reconnectingRef.current = true;
      logger.log(
        `[WiFi Connect] Reconnecting phone to home network (releasing Bose AP: ${ssid ?? "Bose ST"})...`,
      );
      try {
        if (Platform.OS === "android") {
          await disconnectBose();
        } else {
          await WifiManager.disconnectFromSSID(ssid ?? "Bose ST");
        }
      } catch {
        // best-effort, OS will auto-reconnect
      }
      dispatch({ type: "NETWORK_RECONNECTED" });
      reconnectingRef.current = false;
    },
    [dispatch],
  );

  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      logger.log(
        `[Onboarding Flow] Location permission check outcome: ${status}`,
      );
      dispatch(
        status === "granted"
          ? { type: "PERMISSIONS_GRANTED" }
          : { type: "PERMISSIONS_DENIED" },
      );
    } catch (err) {
      logger.log("[Onboarding Flow] Location permission request failed:", err);
      dispatch({ type: "PERMISSIONS_DENIED" });
    }
  }, [dispatch]);

  const checkWifiStatus = useCallback(async () => {
    try {
      const enabled = await WifiManager.isEnabled();
      logger.log(`[Onboarding Flow] Wi-Fi enabled status: ${enabled}`);
      if (enabled) {
        dispatch({ type: "WIFI_ENABLED" });
      } else {
        dispatch({ type: "WIFI_DISABLED" });
      }
    } catch (err) {
      logger.warn(
        "[WiFi Check] Failed to check status, assuming enabled:",
        err,
      );
      dispatch({ type: "WIFI_ENABLED" });
    }
  }, [dispatch]);

  useEffect(() => {
    if (state.step === "CHECKING_PERMISSIONS") {
      void requestPermissions();
    }
  }, [state.step, requestPermissions]);

  useEffect(() => {
    if (state.step === "SCANNING_FOR_HOTSPOT") {
      void scanForHotspot();
    }
  }, [state.step, scanForHotspot]);

  useEffect(() => {
    if (state.step === "CONNECTING_TO_HOTSPOT") {
      const s = state as { ssid: string; bssid: string };
      void connectToHotspot(s.ssid, s.bssid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, connectToHotspot]);

  useEffect(() => {
    if (state.step === "SENDING_CREDENTIALS") {
      void sendCreds();
    }
  }, [state.step, sendCreds]);

  const speakerSsid = (state as { ssid?: string }).ssid;
  const currentStep = state.step;

  useEffect(() => {
    if (currentStep === "WAITING_FOR_SPEAKER_ON_NETWORK") {
      void reconnectPhone(speakerSsid);
    }
  }, [currentStep, speakerSsid, reconnectPhone]);

  useEffect(() => {
    if (state.step !== "CONNECTED_TO_HOTSPOT") {
      return;
    }

    const speakerIp = (state as { speakerIP?: string }).speakerIP;
    if (!speakerIp) {
      return;
    }

    logger.log(`[WiFi Keep-Alive] Starting heartbeat loop to ${speakerIp}...`);

    const intervalId = setInterval(async () => {
      try {
        const ssid = await WifiManager.getCurrentWifiSSID();
        const alive = await probeSpeakerIP(speakerIp, 2000);
        logger.log(
          `[WiFi Keep-Alive] Current SSID: ${ssid || "unknown"}, Heartbeat probe: ${
            alive ? "SUCCESS" : "FAILED"
          }`,
        );
      } catch (err) {
        logger.log("[WiFi Keep-Alive] Heartbeat probe threw error:", err);
      }
    }, 3000);

    return () => {
      logger.log("[WiFi Keep-Alive] Stopping heartbeat loop");
      clearInterval(intervalId);
    };
  }, [state.step, (state as { speakerIP?: string }).speakerIP]);

  useEffect(() => {
    if (state.step === "CHECKING_WIFI") {
      void checkWifiStatus();
    }
  }, [state.step, checkWifiStatus]);

  useEffect(() => {
    if (state.step !== "WIFI_DISABLED") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void checkWifiStatus();
      }
    });

    const intervalId = setInterval(() => {
      void checkWifiStatus();
    }, 2000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [state.step, checkWifiStatus]);

  const { start: startDiscovery, stop: stopDiscovery } = useSpeakerDiscovery({
    timeoutMs: MDNS_DISCOVERY_TIMEOUT_MS,
    ssid: (state as { ssid?: string }).ssid,
    onDiscovered: (result) => {
      dispatch({
        type: "SPEAKER_DISCOVERED",
        host: result.host,
        port: result.port,
        name: result.name,
      });
    },
    onTimeout: () => {
      dispatch({ type: "DISCOVERY_TIMEOUT" });
    },
    onError: () => {
      dispatch({ type: "DISCOVERY_TIMEOUT" });
    },
  });

  useEffect(() => {
    if (state.step === "DISCOVERING_SPEAKER") {
      startDiscovery();
    }
    return () => {
      stopDiscovery();
    };
  }, [state.step, startDiscovery, stopDiscovery]);

  useEffect(() => {
    if (state.step !== "MANUAL_CONNECTING") {
      return;
    }

    let active = true;
    const s = state as { ssid: string; bssid: string };

    const runManualConnect = async () => {
      try {
        logger.log(
          "[Manual Retry Hook] Calling connectToOpenNetwork with",
          s.ssid,
          s.bssid,
        );
        await connectToOpenNetwork(s.ssid, s.bssid);
        logger.log(
          "[Manual Retry Hook] Specifier succeeded, traffic bound to Bose AP, probing...",
        );
      } catch {
        logger.log(
          "[Manual Retry Hook] Specifier also failed, trying IP probe anyway...",
        );
      }

      for (let i = 0; i < 30; i++) {
        if (!active) {
          logger.log(
            "[Manual Retry Hook] Polling cancelled due to unmount or state change",
          );
          return;
        }
        const ip = await findSpeakerIP();
        if (ip) {
          if (active) {
            dispatch({
              type: "HOTSPOT_CONNECTED",
              ssid: s.ssid,
              bssid: s.bssid,
              speakerIP: ip,
            });
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      logger.log("[Manual Retry Hook] Speaker not reachable after 30s polling");
      if (active) {
        dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
      }
    };

    void runManualConnect();

    return () => {
      active = false;
    };
  }, [state, dispatch]);

  return { state, dispatch, checkWifiStatus };
}
