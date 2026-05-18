import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import WifiManager from "react-native-wifi-reborn";
import * as Location from "expo-location";
import { useProvisioning } from "../ProvisioningContext";
import {
  findSpeakerIP,
  isSpeakerHotspot,
  sendCredentials,
  SPEAKER_SSID_PREFIX,
} from "../utils/networkHelpers";

export function useWifiProvisioning() {
  const { state, dispatch } = useProvisioning();

  const scanForHotspot = useCallback(async () => {
    try {
      const networks = await WifiManager.loadWifiList();
      const speaker = networks.find((n) => isSpeakerHotspot(n.SSID));
      if (speaker) {
        dispatch({ type: "HOTSPOT_FOUND", ssid: speaker.SSID });
      } else {
        dispatch({ type: "HOTSPOT_TIMEOUT" });
      }
    } catch {
      dispatch({ type: "HOTSPOT_TIMEOUT" });
    }
  }, [dispatch]);

  const connectToHotspot = useCallback(async () => {
    try {
      await WifiManager.connectToProtectedSSIDPrefix(SPEAKER_SSID_PREFIX, "", false);
      const ip = await findSpeakerIP();
      if (ip) {
        dispatch({
          type: "HOTSPOT_CONNECTED",
          ssid: (state as { ssid: string }).ssid,
          speakerIP: ip,
        });
      } else {
        dispatch({ type: "HOTSPOT_CONNECTION_FAILED" });
      }
    } catch {
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
