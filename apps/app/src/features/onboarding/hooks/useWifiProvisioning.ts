import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import WifiManager from "react-native-wifi-reborn";
import * as Location from "expo-location";
import { useProvisioning } from "../ProvisioningContext";
import { findSpeakerIP, isSpeakerHotspot, sendCredentials } from "../utils/networkHelpers";

export function useWifiProvisioning() {
  const { state, dispatch } = useProvisioning();

  const scanForHotspot = useCallback(async () => {
    try {
      console.log("[WiFi Scan] Starting active scan...");
      const networks = await WifiManager.reScanAndLoadWifiList();
      console.log(`[WiFi Scan] Scan complete. Found ${networks.length} networks:`);
      networks.forEach((n) => {
        console.log(`[WiFi Scan]   SSID: "${n.SSID}" BSSID: ${n.BSSID} level: ${n.level}`);
      });
      const speaker = networks.find((n) => isSpeakerHotspot(n.SSID));
      if (speaker) {
        console.log(`[WiFi Scan] Speaker found: "${speaker.SSID}"`);
        dispatch({ type: "HOTSPOT_FOUND", ssid: speaker.SSID });
      } else {
        console.log("[WiFi Scan] No speaker hotspot found matching Bose ST/SoundTouch pattern");
        dispatch({ type: "HOTSPOT_TIMEOUT" });
      }
    } catch (err) {
      console.log("[WiFi Scan] Error:", err);
      dispatch({ type: "HOTSPOT_TIMEOUT" });
    }
  }, [dispatch]);

  const connectToHotspot = useCallback(async () => {
    const s = state as { ssid: string };
    try {
      console.log(`[WiFi Connect] Connecting to hotspot: "${s.ssid}"`);
      await WifiManager.connectToProtectedSSID(s.ssid, null, false, false);
      const ip = await findSpeakerIP();
      if (ip) {
        dispatch({
          type: "HOTSPOT_CONNECTED",
          ssid: s.ssid,
          speakerIP: ip,
        });
      } else {
        dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
      }
    } catch (err) {
      console.log("[WiFi Connect] Error:", err);
      dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
    }
  }, [dispatch, state]);

  const sendCreds = useCallback(async () => {
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
    }
  }, [dispatch, state]);

  const reconnectPhone = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        await WifiManager.disconnectFromSSID("Bose SoundTouch");
      } else {
        await WifiManager.disconnectFromSSID("Bose SoundTouch");
      }
    } catch {
      // best-effort, OS will auto-reconnect
    }
    dispatch({ type: "NETWORK_RECONNECTED" });
  }, [dispatch]);

  const requestPermissions = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      dispatch(
        status === "granted" ? { type: "PERMISSIONS_GRANTED" } : { type: "PERMISSIONS_DENIED" },
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
      void connectToHotspot();
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
