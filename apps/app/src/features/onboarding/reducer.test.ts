import { describe, expect, it } from "vitest";
import { provisioningReducer } from "./reducer";
import type { ProvisioningState, ProvisioningAction } from "./types";

const IDLE: ProvisioningState = { step: "IDLE" };
const CHECKING_PERMISSIONS: ProvisioningState = { step: "CHECKING_PERMISSIONS" };
const PERMISSIONS_DENIED: ProvisioningState = { step: "PERMISSIONS_DENIED" };
const SCANNING_FOR_HOTSPOT: ProvisioningState = { step: "SCANNING_FOR_HOTSPOT" };
const HOTSPOT_NOT_FOUND: ProvisioningState = { step: "HOTSPOT_NOT_FOUND" };
const CONNECTION_FAILED: ProvisioningState = { step: "CONNECTION_FAILED" };
const DISCOVERY_TIMEOUT: ProvisioningState = { step: "DISCOVERY_TIMEOUT" };

describe("provisioningReducer", () => {
  describe("START", () => {
    it("transitions from IDLE to CHECKING_PERMISSIONS", () => {
      const result = provisioningReducer(IDLE, { type: "START" });
      expect(result).toEqual(CHECKING_PERMISSIONS);
    });

    it("ignores START from any other state", () => {
      const result = provisioningReducer(CHECKING_PERMISSIONS, { type: "START" });
      expect(result).toBe(CHECKING_PERMISSIONS);
    });
  });

  describe("PERMISSIONS_GRANTED", () => {
    it("transitions to SCANNING_FOR_HOTSPOT", () => {
      const result = provisioningReducer(CHECKING_PERMISSIONS, {
        type: "PERMISSIONS_GRANTED",
      });
      expect(result).toEqual(SCANNING_FOR_HOTSPOT);
    });

    it("ignores from wrong state", () => {
      const result = provisioningReducer(SCANNING_FOR_HOTSPOT, {
        type: "PERMISSIONS_GRANTED",
      });
      expect(result).toBe(SCANNING_FOR_HOTSPOT);
    });
  });

  describe("PERMISSIONS_DENIED", () => {
    it("transitions to PERMISSIONS_DENIED", () => {
      const result = provisioningReducer(CHECKING_PERMISSIONS, {
        type: "PERMISSIONS_DENIED",
      });
      expect(result).toEqual(PERMISSIONS_DENIED);
    });
  });

  describe("HOTSPOT_FOUND", () => {
    it("transitions to CONNECTING_TO_HOTSPOT with SSID", () => {
      const result = provisioningReducer(SCANNING_FOR_HOTSPOT, {
        type: "HOTSPOT_FOUND",
        ssid: "Bose SoundTouch 1234",
      });
      expect(result).toEqual({
        step: "CONNECTING_TO_HOTSPOT",
        ssid: "Bose SoundTouch 1234",
      });
    });
  });

  describe("HOTSPOT_TIMEOUT", () => {
    it("transitions to HOTSPOT_NOT_FOUND", () => {
      const result = provisioningReducer(SCANNING_FOR_HOTSPOT, {
        type: "HOTSPOT_TIMEOUT",
      });
      expect(result).toEqual(HOTSPOT_NOT_FOUND);
    });
  });

  describe("HOTSPOT_CONNECTED", () => {
    it("transitions to CONNECTED_TO_HOTSPOT with SSID and IP", () => {
      const connectingState: ProvisioningState = {
        step: "CONNECTING_TO_HOTSPOT",
        ssid: "Bose SoundTouch 1234",
      };
      const result = provisioningReducer(connectingState, {
        type: "HOTSPOT_CONNECTED",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
      });
      expect(result).toEqual({
        step: "CONNECTED_TO_HOTSPOT",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
      });
    });
  });

  describe("HOTSPOT_CONNECTION_FAILED", () => {
    it("transitions to CONNECTION_FAILED", () => {
      const connectingState: ProvisioningState = {
        step: "CONNECTING_TO_HOTSPOT",
        ssid: "Bose SoundTouch 1234",
      };
      const result = provisioningReducer(connectingState, {
        type: "HOTSPOT_CONNECTION_FAILED",
      });
      expect(result).toEqual(CONNECTION_FAILED);
    });
  });

  describe("NETWORK_SELECTED", () => {
    it("transitions to SENDING_CREDENTIALS with all data", () => {
      const connectedState: ProvisioningState = {
        step: "CONNECTED_TO_HOTSPOT",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
      };
      const result = provisioningReducer(connectedState, {
        type: "NETWORK_SELECTED",
        homeSSID: "MyHomeWiFi",
        homePassword: "password123",
      });
      expect(result).toEqual({
        step: "SENDING_CREDENTIALS",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "MyHomeWiFi",
        homePassword: "password123",
      });
    });
  });

  describe("CREDENTIALS_SENT", () => {
    it("transitions to WAITING_FOR_SPEAKER_ON_NETWORK and drops password", () => {
      const sendingState: ProvisioningState = {
        step: "SENDING_CREDENTIALS",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "MyHomeWiFi",
        homePassword: "password123",
      };
      const result = provisioningReducer(sendingState, {
        type: "CREDENTIALS_SENT",
      });
      expect(result).toEqual({
        step: "WAITING_FOR_SPEAKER_ON_NETWORK",
        ssid: "Bose SoundTouch 1234",
      });
      expect(result).not.toHaveProperty("homePassword");
    });
  });

  describe("CREDENTIALS_SEND_FAILED", () => {
    it("transitions to CREDENTIALS_FAILED preserving data", () => {
      const sendingState: ProvisioningState = {
        step: "SENDING_CREDENTIALS",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "MyHomeWiFi",
        homePassword: "password123",
      };
      const result = provisioningReducer(sendingState, {
        type: "CREDENTIALS_SEND_FAILED",
      });
      expect(result).toEqual({
        step: "CREDENTIALS_FAILED",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "MyHomeWiFi",
      });
      expect(result).not.toHaveProperty("homePassword");
    });
  });

  describe("NETWORK_RECONNECTED", () => {
    it("transitions from WAITING_FOR_SPEAKER_ON_NETWORK to DISCOVERING_SPEAKER", () => {
      const waitingState: ProvisioningState = {
        step: "WAITING_FOR_SPEAKER_ON_NETWORK",
        ssid: "Bose SoundTouch 1234",
      };
      const result = provisioningReducer(waitingState, {
        type: "NETWORK_RECONNECTED",
      });
      expect(result).toEqual({ step: "DISCOVERING_SPEAKER" });
    });
  });

  describe("SPEAKER_DISCOVERED", () => {
    it("transitions to PROVISIONING_COMPLETE", () => {
      const discoveringState: ProvisioningState = {
        step: "DISCOVERING_SPEAKER",
      };
      const result = provisioningReducer(discoveringState, {
        type: "SPEAKER_DISCOVERED",
        host: "192.168.1.42",
        port: 8090,
        name: "Living Room",
      });
      expect(result).toEqual({
        step: "PROVISIONING_COMPLETE",
        speakerIP: "192.168.1.42",
        speakerName: "Living Room",
      });
    });
  });

  describe("DISCOVERY_TIMEOUT", () => {
    it("transitions to DISCOVERY_TIMEOUT", () => {
      const discoveringState: ProvisioningState = {
        step: "DISCOVERING_SPEAKER",
      };
      const result = provisioningReducer(discoveringState, {
        type: "DISCOVERY_TIMEOUT",
      });
      expect(result).toEqual(DISCOVERY_TIMEOUT);
    });
  });

  describe("ENTER_MANUAL_IP", () => {
    it("transitions from SCANNING_FOR_HOTSPOT to MANUAL_IP_ENTRY", () => {
      const result = provisioningReducer(SCANNING_FOR_HOTSPOT, {
        type: "ENTER_MANUAL_IP",
      });
      expect(result).toEqual({ step: "MANUAL_IP_ENTRY" });
    });

    it("transitions from DISCOVERY_TIMEOUT to MANUAL_IP_ENTRY", () => {
      const result = provisioningReducer(DISCOVERY_TIMEOUT, {
        type: "ENTER_MANUAL_IP",
      });
      expect(result).toEqual({ step: "MANUAL_IP_ENTRY" });
    });

    it("ignores from wrong state", () => {
      const result = provisioningReducer(IDLE, { type: "ENTER_MANUAL_IP" });
      expect(result).toBe(IDLE);
    });
  });

  describe("MANUAL_IP_VALIDATED", () => {
    it("transitions to PROVISIONING_COMPLETE", () => {
      const manualState: ProvisioningState = { step: "MANUAL_IP_ENTRY" };
      const result = provisioningReducer(manualState, {
        type: "MANUAL_IP_VALIDATED",
        ip: "10.0.0.5",
        name: "Office Speaker",
      });
      expect(result).toEqual({
        step: "PROVISIONING_COMPLETE",
        speakerIP: "10.0.0.5",
        speakerName: "Office Speaker",
      });
    });
  });

  describe("MANUAL_IP_CANCELLED", () => {
    it("transitions back to SCANNING_FOR_HOTSPOT", () => {
      const manualState: ProvisioningState = { step: "MANUAL_IP_ENTRY" };
      const result = provisioningReducer(manualState, {
        type: "MANUAL_IP_CANCELLED",
      });
      expect(result).toEqual(SCANNING_FOR_HOTSPOT);
    });
  });

  describe("RETRY from error states", () => {
    it("PERMISSIONS_DENIED rewinds to CHECKING_PERMISSIONS", () => {
      const result = provisioningReducer(PERMISSIONS_DENIED, { type: "RETRY" });
      expect(result).toEqual(CHECKING_PERMISSIONS);
    });

    it("HOTSPOT_NOT_FOUND rewinds to SCANNING_FOR_HOTSPOT", () => {
      const result = provisioningReducer(HOTSPOT_NOT_FOUND, { type: "RETRY" });
      expect(result).toEqual(SCANNING_FOR_HOTSPOT);
    });

    it("CONNECTION_FAILED rewinds to SCANNING_FOR_HOTSPOT", () => {
      const result = provisioningReducer(CONNECTION_FAILED, { type: "RETRY" });
      expect(result).toEqual(SCANNING_FOR_HOTSPOT);
    });

    it("CREDENTIALS_FAILED rewinds to SELECTING_HOME_NETWORK preserving data", () => {
      const state: ProvisioningState = {
        step: "CREDENTIALS_FAILED",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "MyHomeWiFi",
      };
      const result = provisioningReducer(state, { type: "RETRY" });
      expect(result).toEqual({
        step: "SELECTING_HOME_NETWORK",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "MyHomeWiFi",
      });
    });

    it("DISCOVERY_TIMEOUT rewinds to DISCOVERING_SPEAKER", () => {
      const result = provisioningReducer(DISCOVERY_TIMEOUT, { type: "RETRY" });
      expect(result).toEqual({ step: "DISCOVERING_SPEAKER" });
    });

    it("ignores RETRY from non-error state", () => {
      const result = provisioningReducer(IDLE, { type: "RETRY" });
      expect(result).toBe(IDLE);
    });
  });

  describe("invalid transitions", () => {
    it("returns current state for unknown action type", () => {
      const result = provisioningReducer(IDLE, {
        type: "UNKNOWN",
      } as unknown as ProvisioningAction);
      expect(result).toBe(IDLE);
    });

    it("returns current state when action does not match current step", () => {
      const result = provisioningReducer(IDLE, { type: "HOTSPOT_FOUND", ssid: "x" });
      expect(result).toBe(IDLE);
    });
  });

  describe("full flow", () => {
    it("completes the happy path end to end", () => {
      let state = provisioningReducer(IDLE, { type: "START" });
      expect(state.step).toBe("CHECKING_PERMISSIONS");

      state = provisioningReducer(state, { type: "PERMISSIONS_GRANTED" });
      expect(state.step).toBe("SCANNING_FOR_HOTSPOT");

      state = provisioningReducer(state, {
        type: "HOTSPOT_FOUND",
        ssid: "Bose SoundTouch 5678",
      });
      expect(state).toEqual({
        step: "CONNECTING_TO_HOTSPOT",
        ssid: "Bose SoundTouch 5678",
      });

      state = provisioningReducer(state, {
        type: "HOTSPOT_CONNECTED",
        ssid: "Bose SoundTouch 5678",
        speakerIP: "192.168.1.1",
      });
      expect(state).toEqual({
        step: "CONNECTED_TO_HOTSPOT",
        ssid: "Bose SoundTouch 5678",
        speakerIP: "192.168.1.1",
      });

      state = provisioningReducer(state, {
        type: "NETWORK_SELECTED",
        homeSSID: "Home",
        homePassword: "secret",
      });
      expect(state.step).toBe("SENDING_CREDENTIALS");

      state = provisioningReducer(state, { type: "CREDENTIALS_SENT" });
      expect(state.step).toBe("WAITING_FOR_SPEAKER_ON_NETWORK");

      state = provisioningReducer(state, { type: "NETWORK_RECONNECTED" });
      expect(state.step).toBe("DISCOVERING_SPEAKER");

      state = provisioningReducer(state, {
        type: "SPEAKER_DISCOVERED",
        host: "192.168.1.42",
        port: 8090,
        name: "Living Room",
      });
      expect(state).toEqual({
        step: "PROVISIONING_COMPLETE",
        speakerIP: "192.168.1.42",
        speakerName: "Living Room",
      });
    });

    it("handles the manual IP path", () => {
      let state = provisioningReducer(IDLE, { type: "START" });
      state = provisioningReducer(state, { type: "PERMISSIONS_GRANTED" });
      state = provisioningReducer(state, { type: "ENTER_MANUAL_IP" });
      expect(state.step).toBe("MANUAL_IP_ENTRY");

      state = provisioningReducer(state, {
        type: "MANUAL_IP_VALIDATED",
        ip: "10.0.0.100",
        name: "Studio",
      });
      expect(state).toEqual({
        step: "PROVISIONING_COMPLETE",
        speakerIP: "10.0.0.100",
        speakerName: "Studio",
      });
    });

    it("handles error recovery for password typo", () => {
      let state = provisioningReducer(IDLE, { type: "START" });
      state = provisioningReducer(state, { type: "PERMISSIONS_GRANTED" });
      state = provisioningReducer(state, {
        type: "HOTSPOT_FOUND",
        ssid: "Bose SoundTouch 1234",
      });
      state = provisioningReducer(state, {
        type: "HOTSPOT_CONNECTED",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
      });
      state = provisioningReducer(state, {
        type: "NETWORK_SELECTED",
        homeSSID: "HomeWiFi",
        homePassword: "wrongpass",
      });
      state = provisioningReducer(state, { type: "CREDENTIALS_SEND_FAILED" });
      expect(state.step).toBe("CREDENTIALS_FAILED");

      state = provisioningReducer(state, { type: "RETRY" });
      expect(state).toEqual({
        step: "SELECTING_HOME_NETWORK",
        ssid: "Bose SoundTouch 1234",
        speakerIP: "192.168.1.1",
        homeSSID: "HomeWiFi",
      });

      state = provisioningReducer(state, {
        type: "NETWORK_SELECTED",
        homeSSID: "HomeWiFi",
        homePassword: "correctpass",
      });
      state = provisioningReducer(state, { type: "CREDENTIALS_SENT" });
      state = provisioningReducer(state, { type: "NETWORK_RECONNECTED" });
      state = provisioningReducer(state, {
        type: "SPEAKER_DISCOVERED",
        host: "192.168.1.42",
        port: 8090,
        name: "Living Room",
      });
      expect(state.step).toBe("PROVISIONING_COMPLETE");
    });
  });
});
