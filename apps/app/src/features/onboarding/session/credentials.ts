import { Result, TaggedError } from "better-result";

import type { Credentials } from "./ports";
import type { Security } from "./types";

const MIN_WPA_PASSWORD = 8;
const MAX_WPA_PASSWORD = 63;
const MAX_SSID_BYTES = 32;

/** Reads Android scan `capabilities` (e.g. `[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]`). */
export function securityTypeOf(capabilities: string): Security {
  const caps = capabilities.toUpperCase();
  if (caps.includes("EAP") || caps.includes("WEP") || caps.includes("OWE")) {
    return "unsupported";
  }
  if (caps.includes("PSK")) {
    return "wpa";
  }
  if (caps.includes("SAE")) {
    return "wpa3";
  }
  if (caps.includes("WPA") || caps.includes("RSN")) {
    return "unsupported";
  }
  return "open";
}

export type CredentialsProblem =
  | "ssidEmpty"
  | "ssidTooLong"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "unsupportedSecurity";

export class CredentialsInvalid extends TaggedError("CredentialsInvalid")<{
  problem: CredentialsProblem;
  message: string;
}> {}

/** `wpa3Only`: the speaker may not support WPA3-only networks (untested). */
export type CredentialsWarning = "wpa3Only";

export interface ValidCredentials {
  credentials: Credentials;
  warnings: CredentialsWarning[];
}

function invalid(
  problem: CredentialsProblem,
  message: string,
): Result<ValidCredentials, CredentialsInvalid> {
  return Result.err(new CredentialsInvalid({ problem, message }));
}

/**
 * Checks what the user typed. `security` is the scanned network's security,
 * `undefined` for a manually entered SSID (empty password = open network).
 * Open networks always produce an empty password.
 */
export function validateCredentials(
  input: Credentials,
  security: Security | undefined,
): Result<ValidCredentials, CredentialsInvalid> {
  const { ssid, password } = input;
  if (ssid.trim() === "") {
    return invalid("ssidEmpty", "Enter the network name.");
  }
  if (new TextEncoder().encode(ssid).length > MAX_SSID_BYTES) {
    return invalid("ssidTooLong", "Network names are at most 32 bytes.");
  }
  if (security === "unsupported") {
    return invalid(
      "unsupportedSecurity",
      "The speaker can't join WEP or enterprise networks.",
    );
  }
  if (security === "open" || (security === undefined && password === "")) {
    return Result.ok({ credentials: { ssid, password: "" }, warnings: [] });
  }
  if (password === "") {
    return invalid("passwordRequired", "Enter the Wi-Fi password.");
  }
  if (password.length < MIN_WPA_PASSWORD) {
    return invalid(
      "passwordTooShort",
      "Wi-Fi passwords have at least 8 characters.",
    );
  }
  if (password.length > MAX_WPA_PASSWORD) {
    return invalid(
      "passwordTooLong",
      "Wi-Fi passwords have at most 63 characters.",
    );
  }
  return Result.ok({
    credentials: { ssid, password },
    warnings: security === "wpa3" ? ["wpa3Only"] : [],
  });
}
