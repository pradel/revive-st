export type ProvisioningState =
  | { step: "IDLE" }
  | { step: "CHECKING_PERMISSIONS" }
  | { step: "PERMISSIONS_DENIED" }
  | { step: "CHECKING_WIFI" }
  | { step: "WIFI_DISABLED" }
  | { step: "SCANNING_FOR_HOTSPOT" }
  | { step: "HOTSPOT_NOT_FOUND" }
  | { step: "CONNECTING_TO_HOTSPOT"; ssid: string; bssid: string }
  | { step: "CONNECTION_FAILED"; ssid: string; bssid: string }
  | {
      step: "CONNECTED_TO_HOTSPOT";
      ssid: string;
      bssid: string;
      speakerIP: string;
    }
  | {
      step: "SELECTING_HOME_NETWORK";
      ssid: string;
      bssid: string;
      speakerIP: string;
      homeSSID?: string;
      scannedNetworks?: string[];
    }
  | {
      step: "SENDING_CREDENTIALS";
      ssid: string;
      bssid: string;
      speakerIP: string;
      homeSSID: string;
      homePassword: string;
    }
  | {
      step: "CREDENTIALS_FAILED";
      ssid: string;
      bssid: string;
      speakerIP: string;
      homeSSID: string;
    }
  | { step: "WAITING_FOR_SPEAKER_ON_NETWORK"; ssid: string }
  | { step: "DISCOVERING_SPEAKER" }
  | { step: "DISCOVERY_TIMEOUT" }
  | { step: "SELECTING_SPEAKER"; speakers: { ssid: string; bssid: string }[] }
  | {
      step: "PROVISIONING_COMPLETE";
      speakerIP: string;
      speakerName: string;
    };

export type ProvisioningAction =
  | { type: "START" }
  | { type: "PERMISSIONS_GRANTED" }
  | { type: "PERMISSIONS_DENIED" }
  | { type: "WIFI_ENABLED" }
  | { type: "WIFI_DISABLED" }
  | { type: "HOTSPOT_FOUND"; ssid: string; bssid: string }
  | { type: "HOTSPOT_TIMEOUT" }
  | {
      type: "HOTSPOT_CONNECTED";
      ssid: string;
      bssid: string;
      speakerIP: string;
    }
  | { type: "HOTSPOT_CONNECTION_FAILED" }
  | {
      type: "NETWORK_SELECTED";
      homeSSID: string;
      homePassword: string;
    }
  | { type: "CREDENTIALS_SENT" }
  | { type: "CREDENTIALS_SEND_FAILED" }
  | { type: "NETWORK_RECONNECTED" }
  | {
      type: "SPEAKER_DISCOVERED";
      host: string;
      port: number;
      name: string;
    }
  | { type: "DISCOVERY_TIMEOUT" }
  | { type: "SPEAKERS_FOUND"; speakers: { ssid: string; bssid: string }[] }
  | { type: "RETRY" };

export const initialState: ProvisioningState = { step: "IDLE" };
