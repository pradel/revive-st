import { DEFAULT_SERVER_URL } from "../server/server-url";
import { isSameOrigin } from "../speakers/lib/account-id";
import type { RadioStatus } from "../speakers/lib/speaker-radio";

/**
 * How a speaker just set up on Wi-Fi gets internet radio: the Revive ST
 * server run for everyone, a Revive ST server the user runs, or whatever it
 * uses now.
 */
export type RadioChoice = "hosted" | "own" | "keep";

/**
 * The option the speaker already plays radio through, when it's one of the
 * first two: the hosted server, or the user's own server the app is set to.
 * Picking it keeps the speaker as it is, so no "keep" option repeats it.
 */
export function currentChoice(
  radio: RadioStatus | undefined,
  ourServer: string,
): "hosted" | "own" | undefined {
  if (radio?.kind !== "ready") {
    return undefined;
  }
  if (isSameOrigin(radio.margeURL, DEFAULT_SERVER_URL)) {
    return "hosted";
  }
  return ourServer !== DEFAULT_SERVER_URL &&
    isSameOrigin(radio.margeURL, ourServer)
    ? "own"
    : undefined;
}

/** The "keep" choice, as the speaker's radio makes it. */
export interface KeepOption {
  readonly title: string;
  readonly subtitle: string;
  /** The button that confirms it. */
  readonly button: string;
}

/**
 * What keeping the speaker as it is means: keeping another server it plays
 * radio through, or one it uses that isn't giving it radio yet, or doing
 * without radio for now (Bose's servers are gone, and a speaker paired
 * nowhere has none). None until its radio is checked, and none when it
 * already plays through one of the other options (`currentChoice`).
 */
export function keepOption(
  radio: RadioStatus | undefined,
  ourServer: string,
): KeepOption | undefined {
  if (
    radio === undefined ||
    radio.kind === "checking" ||
    radio.kind === "unreachable" ||
    currentChoice(radio, ourServer) !== undefined
  ) {
    return undefined;
  }
  if (radio.kind === "ready") {
    return {
      title: `Keep ${radio.through ?? radio.serverName}`,
      subtitle: "It already plays internet radio through it",
      button: "Keep it as it is",
    };
  }
  if (radio.setup.kind === "leaving") {
    return {
      title: `Keep ${radio.setup.server}`,
      subtitle: "Its internet radio isn't ready there yet",
      button: "Keep it as it is",
    };
  }
  return {
    title: "Not now",
    subtitle: "No internet radio until you set it up",
    button: "Skip for now",
  };
}

/**
 * The choice offered first: what a speaker that already plays radio uses,
 * else the server the app is set to.
 */
export function defaultRadioChoice(
  radio: RadioStatus | undefined,
  ourServer: string,
): RadioChoice {
  const current = currentChoice(radio, ourServer);
  if (current !== undefined) {
    return current;
  }
  if (radio?.kind === "ready") {
    return "keep";
  }
  return ourServer === DEFAULT_SERVER_URL ? "hosted" : "own";
}
