import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import WifiManager from "react-native-wifi-reborn";
import * as Location from "expo-location";
import { connectToOpenNetwork } from "expo-bose-wifi";
import { useProvisioning } from "../ProvisioningContext";
import {
  findSpeakerIP,
  isSpeakerHotspot,
  sendCredentials,
} from "../utils/networkHelpers";

export function useWifiProvisioning() {
  const { state, dispatch } = useProvisioning();
  const scanningRef = useRef(false);
  const connectingRef = useRef(false);
  const sendingRef = useRef(false);
  const reconnectingRef = useRef(false);

  const scanForHotspot = useCallback(async () => {
    if (scanningRef.current) {
      console.log("[WiFi Scan] Already scanning, skipping");
      return;
    }
    scanningRef.current = true;
    try {
      console.log("[WiFi Scan] Starting active scan...");
      const networks = await WifiManager.reScanAndLoadWifiList();
      console.log(
        `[WiFi Scan] Scan complete. Found ${networks.length} networks:`,
      );
      networks.forEach((n) => {
        console.log(
          `[WiFi Scan]   SSID: "${n.SSID}" BSSID: ${n.BSSID} level: ${n.level} caps: ${n.capabilities}`,
        );
      });
      const speaker = networks.find((n) => isSpeakerHotspot(n.SSID));
      if (speaker) {
        console.log(
          `[WiFi Scan] Speaker found: "${speaker.SSID}" BSSID: ${speaker.BSSID} capabilities: "${speaker.capabilities}" level: ${speaker.level}`,
        );
        dispatch({
          type: "HOTSPOT_FOUND",
          ssid: speaker.SSID,
          bssid: speaker.BSSID,
        });
      } else {
        console.log(
          "[WiFi Scan] No speaker hotspot found matching Bose ST/SoundTouch pattern",
        );
        dispatch({ type: "HOTSPOT_TIMEOUT" });
      }
    } catch (err) {
      console.log("[WiFi Scan] Error:", err);
      dispatch({ type: "HOTSPOT_TIMEOUT" });
    } finally {
      scanningRef.current = false;
    }
  }, [dispatch]);

  const connectToHotspot = useCallback(
    async (ssid: string, bssid: string) => {
      if (connectingRef.current) {
        console.log(
          "[WiFi Connect] Already connecting, skipping duplicate call",
        );
        return;
      }
      connectingRef.current = true;
      try {
        console.log(
          `[WiFi Connect] Platform: ${Platform.OS} ${Platform.Version}`,
        );
        console.log(`[WiFi Connect] Connecting to: "${ssid}" (${bssid})`);

        if (Platform.OS === "android") {
          console.log("[WiFi Connect] Using native BoseWifi module");
          const result = await connectToOpenNetwork(ssid, bssid);
          console.log(`[WiFi Connect] Native result: ${result.message}`);
          dispatch({
            type: "HOTSPOT_CONNECTED",
            ssid,
            bssid,
            speakerIP: result.ip,
          });
        } else {
          console.log("[WiFi Connect] Using react-native-wifi-reborn (iOS)");
          await WifiManager.connectToProtectedSSIDPrefix(ssid, "", false);

          console.log("[WiFi Connect] Connected, probing speaker IP...");
          const ip = await findSpeakerIP();
          if (ip) {
            console.log(`[WiFi Connect] Speaker reachable at ${ip}`);
            dispatch({ type: "HOTSPOT_CONNECTED", ssid, bssid, speakerIP: ip });
          } else {
            console.log(
              "[WiFi Connect] Connected to hotspot but speaker not reachable on any candidate IP",
            );
            dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
          }
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "timeoutOccurred") {
          console.log(
            "[WiFi Connect] TIMEOUT: Connection did not complete within 180s",
          );
        } else {
          console.log("[WiFi Connect] ERROR (not timeout):", e.code);
          console.log("[WiFi Connect] Error message:", e.message);
        }
        console.log(
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
    if (sendingRef.current) return;
    sendingRef.current = true;
    const s = state as {
      ssid: string;
      speakerIP: string;
      homeSSID: string;
      homePassword: string;
    };
    try {
      await sendCredentials(s.speakerIP, s.homeSSID, s.homePassword);
      dispatch({ type: "CREDENTIALS_SENT" });
    } catch {
      dispatch({ type: "CREDENTIALS_SEND_FAILED" });
    } finally {
      sendingRef.current = false;
    }
  }, [dispatch, state]);

  const reconnectPhone = useCallback(async () => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    try {
      if (Platform.OS === "android") {
        await WifiManager.disconnectFromSSID("Bose ST");
      } else {
        await WifiManager.disconnectFromSSID("Bose ST");
      }
    } catch {
      // best-effort, OS will auto-reconnect
    }
    dispatch({ type: "NETWORK_RECONNECTED" });
    reconnectingRef.current = false;
  }, [dispatch]);

  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      dispatch(
        status === "granted"
          ? { type: "PERMISSIONS_GRANTED" }
          : { type: "PERMISSIONS_DENIED" },
      );
    } catch {
      dispatch({ type: "PERMISSIONS_DENIED" });
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
  }, [state.step, connectToHotspot]);

  useEffect(() => {
    if (state.step === "SENDING_CREDENTIALS") {
      void sendCreds();
    }
  }, [state.step, sendCreds]);

  useEffect(() => {
    if (state.step === "WAITING_FOR_SPEAKER_ON_NETWORK") {
      void reconnectPhone();
    }
  }, [state.step, reconnectPhone]);

  return { state, dispatch };
}
