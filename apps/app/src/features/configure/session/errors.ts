import { matchError, TaggedError } from "better-result";

import { SERVER_URL_FIELDS, type ServerUrls } from "./console";
import type { RecoveryAction, StepId } from "./types";

/** The speaker didn't answer on its address, or another device did. */
export class SpeakerOffline extends TaggedError("SpeakerOffline")<{
  host: string;
  message: string;
}> {}

/** The server picked in Settings is not an address a speaker can be given. */
export class InvalidServer extends TaggedError("InvalidServer")<{
  origin: string;
}> {}

export class ServerUnreachable extends TaggedError("ServerUnreachable")<{
  /** What the run needed from the server. */
  need: "account" | "presets" | "contact";
  message: string;
}> {}

/** No connection to the TAP console on port 17000. */
export class ConsoleUnavailable extends TaggedError("ConsoleUnavailable")<{
  message: string;
}> {}

/** The console refused a command, or didn't answer it. */
export class CommandFailed extends TaggedError("CommandFailed")<{
  command: string;
  message: string;
  reply?: string;
}> {}

/** Read back before restarting, the speaker's configuration doesn't hold the new addresses. */
export class SettingsNotSaved extends TaggedError("SettingsNotSaved")<{
  fields: (keyof ServerUrls)[];
}> {}

/** The restart command couldn't be sent. */
export class RestartFailed extends TaggedError("RestartFailed")<{
  message: string;
}> {}

/** The speaker kept answering: it never went down to restart. */
export class DidNotRestart extends TaggedError("DidNotRestart") {}

/** The speaker went down but didn't answer again in time. */
export class NotBack extends TaggedError("NotBack")<{
  deviceID: string;
}> {}

/** Back from the restart, the speaker still uses another server or other addresses. */
export class NotApplied extends TaggedError("NotApplied")<{
  /** `margeURL` from `/info`, or fields read back from the console. */
  what: "server" | (keyof ServerUrls)[];
}> {}

/** Back from the restart, the speaker isn't paired with the household account. */
export class NotPaired extends TaggedError("NotPaired") {}

/** The speaker restarted with the new settings but hasn't made a request to our server. */
export class ServerNotContacted extends TaggedError("ServerNotContacted") {}

/** A port threw something the session doesn't model. */
export class UnexpectedError extends TaggedError("UnexpectedError")<{
  step: StepId;
  message: string;
}> {}

export type ConfigureError =
  | SpeakerOffline
  | InvalidServer
  | ServerUnreachable
  | ConsoleUnavailable
  | CommandFailed
  | SettingsNotSaved
  | RestartFailed
  | DidNotRestart
  | NotBack
  | NotApplied
  | NotPaired
  | ServerNotContacted
  | UnexpectedError;

/** Buttons offered by the failed view, in display order. */
export function recoveryActions(error: ConfigureError): RecoveryAction[] {
  const retry = (): RecoveryAction[] => ["retry"];
  const checkAgain = (): RecoveryAction[] => ["checkAgain", "retry"];
  return matchError<ConfigureError, RecoveryAction[]>(error, {
    SpeakerOffline: retry,
    // Only another server in Settings helps.
    InvalidServer: () => [],
    ServerUnreachable: retry,
    ConsoleUnavailable: retry,
    CommandFailed: retry,
    SettingsNotSaved: retry,
    RestartFailed: retry,
    DidNotRestart: retry,
    NotBack: checkAgain,
    NotApplied: retry,
    NotPaired: retry,
    ServerNotContacted: checkAgain,
    UnexpectedError: retry,
  });
}

export interface ErrorCopy {
  title: string;
  message: string;
}

const FIELD_LABELS: Record<keyof ServerUrls, string> = {
  bmxRegistryUrl: "radio services",
  statsServerUrl: "statistics",
  margeServerUrl: "account and presets",
  swUpdateUrl: "software updates",
};

const fieldList = (fields: readonly (keyof ServerUrls)[]) =>
  SERVER_URL_FIELDS.filter((field) => fields.includes(field))
    .map((field) => FIELD_LABELS[field])
    .join(", ");

const UNCHANGED = "Nothing was changed on the speaker.";
const NOT_RESTARTED = "The speaker wasn't restarted, so it works as before.";

const SERVER_UNREACHABLE_COPY: Record<
  ServerUnreachable["need"],
  (speakerName: string, serverHost: string) => ErrorCopy
> = {
  presets: (speakerName, serverHost) => ({
    title: "Couldn't save your presets",
    message: `The Revive ST server (${serverHost}) didn't accept ${speakerName}'s presets, so setup stopped before they could be lost. Check this phone's internet connection. ${UNCHANGED}`,
  }),
  account: (_speakerName, serverHost) => ({
    title: "Can't reach Revive ST",
    message: `The Revive ST server (${serverHost}) didn't answer. Check this phone's internet connection. ${UNCHANGED}`,
  }),
  contact: (speakerName, serverHost) => ({
    title: "Can't reach Revive ST",
    message: `The Revive ST server (${serverHost}) stopped answering before ${speakerName} was restarted. Check this phone's internet connection and try again.`,
  }),
};

/** User-facing copy for the failed view. Never contains the account id. */
export function describeError(
  error: ConfigureError,
  speakerName: string,
  serverHost: string,
): ErrorCopy {
  return matchError<ConfigureError, ErrorCopy>(error, {
    SpeakerOffline: () => ({
      title: `Can't reach ${speakerName}`,
      message: `Check that ${speakerName} is on and that this phone is on the same Wi-Fi network. ${UNCHANGED}`,
    }),
    InvalidServer: () => ({
      title: "Server address not usable",
      message: `${serverHost} can't be given to a speaker. Pick another server in Settings. ${UNCHANGED}`,
    }),
    ServerUnreachable: (unreachable) =>
      SERVER_UNREACHABLE_COPY[unreachable.need](speakerName, serverHost),
    ConsoleUnavailable: () => ({
      title: `${speakerName} isn't accepting setup`,
      message: `Revive ST sets up speakers through a service on port 17000, and ${speakerName} didn't answer there. Unplug the speaker for 10 seconds, plug it back in and try again. ${UNCHANGED}`,
    }),
    CommandFailed: () => ({
      title: `${speakerName} refused a setting`,
      message: `${speakerName} didn't accept one of the new settings. ${NOT_RESTARTED} Its firmware may not support this: try again, and share the logs if it keeps failing.`,
    }),
    SettingsNotSaved: (notSaved) => ({
      title: `${speakerName} didn't keep the new settings`,
      message: `Read back from the speaker, these still point elsewhere: ${fieldList(notSaved.fields)}. ${NOT_RESTARTED}`,
    }),
    RestartFailed: () => ({
      title: `Couldn't restart ${speakerName}`,
      message:
        "The settings were saved but the restart command didn't go through. Try again, or unplug the speaker for 10 seconds and plug it back in.",
    }),
    DidNotRestart: () => ({
      title: `${speakerName} didn't restart`,
      message:
        "It kept answering after the restart command. Try again, or unplug the speaker for 10 seconds, plug it back in, then check its status in its settings.",
    }),
    NotBack: () => ({
      title: `${speakerName} hasn't come back yet`,
      message:
        "Restarting can take a few minutes. Check that the speaker is plugged in and its Wi-Fi light is solid white, then check again.",
    }),
    NotApplied: (notApplied) => ({
      title: `${speakerName} restarted with its old settings`,
      message:
        notApplied.what === "server"
          ? "It still uses another server for its account and presets. Try setting it up again."
          : `These still point elsewhere: ${fieldList(notApplied.what)}. Try setting it up again.`,
    }),
    NotPaired: () => ({
      title: `${speakerName} isn't linked to your account`,
      message:
        "It uses Revive ST but isn't paired with your household's account, so its presets won't be kept. Try setting it up again.",
    }),
    ServerNotContacted: () => ({
      title: `${speakerName} hasn't reached Revive ST`,
      message: `It restarted with the new settings but hasn't contacted ${serverHost} yet. Check that your network lets the speaker reach the internet, then check again.`,
    }),
    UnexpectedError: (unexpected) => ({
      title: "Something went wrong",
      message: unexpected.message,
    }),
  });
}
