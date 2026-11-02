import { DEFAULT_SERVER_URL, serverHost } from "../server/server-url";
import type { RadioStatus } from "../speakers/lib/speaker-radio";

/**
 * How a speaker just set up on Wi-Fi gets internet radio: the Revive ST
 * server run for everyone, a Revive ST server the user runs, or whatever it
 * uses now.
 */
export type RadioChoice = "hosted" | "own" | "keep";

/** The "keep" choice, as the speaker's radio makes it. */
export interface KeepOption {
  readonly title: string;
  readonly subtitle: string;
  /** The button that confirms it. */
  readonly button: string;
}

/**
 * What keeping the speaker as it is means: keeping the server it plays radio
 * through, or one it uses that isn't giving it radio yet, or doing without
 * radio for now (Bose's servers are gone, and a speaker paired nowhere has
 * none).
 */
export function keepOption(
  radio: RadioStatus | undefined,
  ourServer: string,
): KeepOption {
  if (
    radio === undefined ||
    radio.kind === "checking" ||
    radio.kind === "unreachable"
  ) {
    return {
      title: "Keep its current server",
      subtitle: "Still checking which one it uses",
      button: "Keep it as it is",
    };
  }
  if (radio.kind === "ready") {
    return {
      title: `Keep ${radio.through ?? `Revive ST (${serverHost(ourServer)})`}`,
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
 * The choice offered first: a speaker that already plays radio keeps its
 * server, any other goes to the server the app is set to.
 */
export function defaultRadioChoice(
  radio: RadioStatus | undefined,
  ourServer: string,
): RadioChoice {
  if (radio?.kind === "ready") {
    return "keep";
  }
  return ourServer === DEFAULT_SERVER_URL ? "hosted" : "own";
}
