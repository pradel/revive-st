import {
  initialState,
  type ProvisioningAction,
  type ProvisioningState,
} from "./types";

export function provisioningReducer(
  state: ProvisioningState,
  action: ProvisioningAction,
): ProvisioningState {
  switch (action.type) {
    case "START":
      if (state.step === "IDLE") {
        return { step: "CHECKING_PERMISSIONS" };
      }
      return state;

    case "PERMISSIONS_GRANTED":
      if (state.step === "CHECKING_PERMISSIONS") {
        return { step: "CHECKING_WIFI" };
      }
      return state;

    case "WIFI_ENABLED":
      if (state.step === "CHECKING_WIFI" || state.step === "WIFI_DISABLED") {
        return { step: "SCANNING_FOR_HOTSPOT" };
      }
      return state;

    case "WIFI_DISABLED":
      if (state.step === "CHECKING_WIFI") {
        return { step: "WIFI_DISABLED" };
      }
      return state;

    case "PERMISSIONS_DENIED":
      if (state.step === "CHECKING_PERMISSIONS") {
        return { step: "PERMISSIONS_DENIED" };
      }
      return state;

    case "HOTSPOT_FOUND":
      if (
        state.step === "SCANNING_FOR_HOTSPOT" ||
        state.step === "SELECTING_SPEAKER"
      ) {
        return {
          step: "CONNECTING_TO_HOTSPOT",
          ssid: action.ssid,
          bssid: action.bssid,
        };
      }
      return state;

    case "SPEAKERS_FOUND":
      if (state.step === "SCANNING_FOR_HOTSPOT") {
        return {
          step: "SELECTING_SPEAKER",
          speakers: action.speakers,
        };
      }
      return state;

    case "HOTSPOT_TIMEOUT":
      if (state.step === "SCANNING_FOR_HOTSPOT") {
        return { step: "HOTSPOT_NOT_FOUND" };
      }
      return state;

    case "HOTSPOT_CONNECTED":
      if (state.step === "CONNECTING_TO_HOTSPOT") {
        return {
          step: "CONNECTED_TO_HOTSPOT",
          ssid: state.ssid,
          bssid: state.bssid,
          speakerIP: action.speakerIP,
        };
      }
      return state;

    case "HOTSPOT_CONNECTION_FAILED":
      if (state.step === "CONNECTING_TO_HOTSPOT") {
        return {
          step: "CONNECTION_FAILED",
          ssid: state.ssid,
          bssid: state.bssid,
        };
      }
      return state;

    case "NETWORK_SELECTED":
      if (
        state.step === "CONNECTED_TO_HOTSPOT" ||
        state.step === "SELECTING_HOME_NETWORK"
      ) {
        return {
          step: "SENDING_CREDENTIALS",
          ssid: state.ssid,
          bssid: state.bssid,
          speakerIP: state.speakerIP,
          homeSSID: action.homeSSID,
          homePassword: action.homePassword,
        };
      }
      return state;

    case "CREDENTIALS_SENT":
      if (state.step === "SENDING_CREDENTIALS") {
        return {
          step: "WAITING_FOR_SPEAKER_ON_NETWORK",
          ssid: state.ssid,
        };
      }
      return state;

    case "CREDENTIALS_SEND_FAILED":
      if (state.step === "SENDING_CREDENTIALS") {
        return {
          step: "CREDENTIALS_FAILED",
          ssid: state.ssid,
          bssid: state.bssid,
          speakerIP: state.speakerIP,
          homeSSID: state.homeSSID,
        };
      }
      return state;

    case "NETWORK_RECONNECTED":
      if (state.step === "WAITING_FOR_SPEAKER_ON_NETWORK") {
        return { step: "DISCOVERING_SPEAKER", ssid: state.ssid };
      }
      return state;

    case "SPEAKER_DISCOVERED":
      if (state.step === "DISCOVERING_SPEAKER") {
        return {
          step: "PROVISIONING_COMPLETE",
          speakerIP: action.host,
          speakerName: action.name,
        };
      }
      return state;

    case "DISCOVERY_TIMEOUT":
      if (state.step === "DISCOVERING_SPEAKER") {
        return { step: "DISCOVERY_TIMEOUT", ssid: state.ssid };
      }
      return state;

    case "RETRY": {
      switch (state.step) {
        case "PERMISSIONS_DENIED":
          return { step: "CHECKING_PERMISSIONS" };
        case "WIFI_DISABLED":
          return { step: "CHECKING_WIFI" };
        case "HOTSPOT_NOT_FOUND":
          return { step: "SCANNING_FOR_HOTSPOT" };
        case "SELECTING_SPEAKER":
          return { step: "SCANNING_FOR_HOTSPOT" };
        case "CONNECTION_FAILED":
          return { step: "SCANNING_FOR_HOTSPOT" };
        case "CREDENTIALS_FAILED":
          return {
            step: "SELECTING_HOME_NETWORK",
            ssid: state.ssid,
            bssid: state.bssid,
            speakerIP: state.speakerIP,
            homeSSID: state.homeSSID,
          };
        case "DISCOVERY_TIMEOUT":
          return { step: "DISCOVERING_SPEAKER", ssid: state.ssid };
        default:
          return state;
      }
    }

    default:
      return state;
  }
}

export { initialState };
