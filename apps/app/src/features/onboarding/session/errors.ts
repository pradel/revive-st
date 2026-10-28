import { matchError, TaggedError } from "better-result";

import type { RecoveryAction, StepId } from "./types";

// Speaker HTTP errors (returned by the SpeakerHttp port).

/** Network failure, timeout or abort: the request may or may not have reached the speaker. */
export class SpeakerTransportError extends TaggedError(
  "SpeakerTransportError",
)<{ message: string }> {}

/** The speaker answered with `<errors>`; fields come from the first error. */
export class SpeakerApiError extends TaggedError("SpeakerApiError")<{
  /** Bose `<error name="…">`, e.g. `WIFI_PROFILE_SETUP_FAILED` (`name` itself holds the tag). */
  errorName: string;
  value: number;
  message: string;
}> {}

/** HTTP non-2xx without `<errors>`, or a reply that could not be parsed. */
export class SpeakerResponseError extends TaggedError("SpeakerResponseError")<{
  message: string;
}> {}

export type SpeakerError =
  | SpeakerTransportError
  | SpeakerApiError
  | SpeakerResponseError;

// Setup errors (shown in the failed view).

export class PermissionDenied extends TaggedError("PermissionDenied")<{
  canAskAgain: boolean;
}> {}

export class PermissionCoarse extends TaggedError("PermissionCoarse") {}

export class LocationServicesOff extends TaggedError("LocationServicesOff") {}

/** Android refused the request (approval dialog cancelled, network unavailable). */
export class JoinRejected extends TaggedError("JoinRejected")<{
  ssid: string;
}> {}

export class JoinTimeout extends TaggedError("JoinTimeout")<{
  ssid: string;
}> {}

export class SpeakerUnreachable extends TaggedError("SpeakerUnreachable")<{
  ssid: string;
  /** `noAnswer`: `/info` stayed silent; `wrongSpeaker`: its deviceID does not match the setup network. */
  reason: "noAnswer" | "wrongSpeaker";
}> {}

export class ManualJoinNotConnected extends TaggedError(
  "ManualJoinNotConnected",
) {}

export class LinkLost extends TaggedError("LinkLost") {}

export class DeliveryFailed extends TaggedError("DeliveryFailed")<{
  ssid: string;
  message: string;
  cause?: SpeakerError;
}> {}

export class HomeWifiNotRestored extends TaggedError("HomeWifiNotRestored")<{
  ssid: string;
}> {}

export class NotVerified extends TaggedError("NotVerified")<{
  deviceID: string;
  /** Set when the user entered an address that did not confirm the speaker. */
  ip?: string;
}> {}

/** A port threw something the session does not model. */
export class UnexpectedError extends TaggedError("UnexpectedError")<{
  step: StepId;
  message: string;
}> {}

export type SetupError =
  | PermissionDenied
  | PermissionCoarse
  | LocationServicesOff
  | JoinRejected
  | JoinTimeout
  | SpeakerUnreachable
  | ManualJoinNotConnected
  | LinkLost
  | DeliveryFailed
  | HomeWifiNotRestored
  | NotVerified
  | UnexpectedError;

/** Buttons offered by the failed view, in display order. */
export function recoveryActions(error: SetupError): RecoveryAction[] {
  return matchError<SetupError, RecoveryAction[]>(error, {
    PermissionDenied: (denied) =>
      denied.canAskAgain
        ? ["requestPermission", "startOver"]
        : ["openAppSettings", "retry", "startOver"],
    PermissionCoarse: () => ["openAppSettings", "retry"],
    LocationServicesOff: () => ["openLocationSettings", "retry"],
    JoinRejected: () => ["retry", "manualJoin", "startOver"],
    JoinTimeout: () => ["retry", "manualJoin", "startOver"],
    SpeakerUnreachable: () => ["retry", "manualJoin"],
    ManualJoinNotConnected: () => ["openWifiSettings", "retry"],
    LinkLost: () => ["retry"],
    DeliveryFailed: () => ["retry", "editCredentials"],
    HomeWifiNotRestored: () => ["openWifiSettings", "continueAnyway"],
    NotVerified: () => ["retry", "enterIp", "startOver"],
    UnexpectedError: () => ["retry", "startOver"],
  });
}

export interface ErrorCopy {
  title: string;
  body: string;
}

/** User-facing copy for the failed view. Never contains credentials. */
export function describeError(error: SetupError): ErrorCopy {
  return matchError<SetupError, ErrorCopy>(error, {
    PermissionDenied: (denied) => ({
      title: "Location permission needed",
      body: denied.canAskAgain
        ? "Android only shows nearby Wi-Fi networks to apps with location access. Allow it to find your speaker."
        : "Location access is turned off for this app. Allow precise location in the app settings, then try again.",
    }),
    PermissionCoarse: () => ({
      title: "Precise location needed",
      body: "Wi-Fi scanning needs precise location. Turn on “Use precise location” in the app settings, then try again.",
    }),
    LocationServicesOff: () => ({
      title: "Location is off",
      body: "Android needs location services on to scan for Wi-Fi networks. Turn them on, then try again.",
    }),
    JoinRejected: (rejected) => ({
      title: "Couldn't connect to the speaker",
      body: `Android didn't connect to ${rejected.ssid}. If a “connect to device” dialog appears, tap Connect.`,
    }),
    JoinTimeout: (timeout) => ({
      title: "Couldn't connect to the speaker",
      body: `Connecting to ${timeout.ssid} took too long. Check that the speaker's Wi-Fi light is solid amber and try again.`,
    }),
    SpeakerUnreachable: (unreachable) => ({
      title: "The speaker isn't answering",
      body:
        unreachable.reason === "wrongSpeaker"
          ? `The device on ${unreachable.ssid} isn't the expected speaker.`
          : `Connected to ${unreachable.ssid}, but the speaker didn't answer.`,
    }),
    ManualJoinNotConnected: () => ({
      title: "Not connected",
      body: "The phone isn't connected to the speaker's network yet. Connect to it in the Wi-Fi settings, then try again.",
    }),
    LinkLost: () => ({
      title: "Lost the connection to the speaker",
      body: "The phone disconnected from the speaker's network. Try again to reconnect.",
    }),
    DeliveryFailed: (failed) => ({
      title: "Couldn't send the Wi-Fi details",
      body: `The speaker didn't confirm joining ${failed.ssid}.`,
    }),
    HomeWifiNotRestored: (notRestored) => ({
      title: "Phone not back on Wi-Fi",
      body: `Reconnect the phone to ${notRestored.ssid} to find the speaker.`,
    }),
    NotVerified: (notVerified) => ({
      title: "Speaker not found on your network",
      body:
        notVerified.ip === undefined
          ? "The speaker joined the network but didn't show up. Make sure the phone is on the same network."
          : `The device at ${notVerified.ip} isn't this speaker.`,
    }),
    UnexpectedError: (unexpected) => ({
      title: "Something went wrong",
      body: unexpected.message,
    }),
  });
}
