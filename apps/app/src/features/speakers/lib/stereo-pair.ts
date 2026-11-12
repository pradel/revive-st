import type { SpeakerGroup, ZoneResponse } from "bose-api-speaker-client";

import type { BoseSpeaker } from "../registry/types";
import { isHouseholdAccountId } from "./account-id";

/** A speaker's side in a stereo pair: the master plays the left channel. */
export type PairRole = "LEFT" | "RIGHT";

/**
 * A stereo pair as the app keeps it: two SoundTouch 10s the firmware groups,
 * listed as one speaker keyed by its master. Remembered with the speakers,
 * so it stays one card while they connect or are offline.
 */
export interface SpeakerPair {
  /** The id our server gave the pair. */
  id: string;
  name: string;
  masterDeviceID: string;
  roles: readonly { deviceID: string; role: PairRole }[];
}

/** The longest pair name the app sends, as the firmware stores it. */
export const PAIR_NAME_MAX_LENGTH = 64;

/** Whether `/info`'s `type` is a SoundTouch 10, the only model that pairs. */
export const isSoundTouch10 = (type: string): boolean => {
  const model = type.toLowerCase();
  return !model.includes("portable") && /\b10\b/.test(model);
};

export const pairFromGroup = (group: SpeakerGroup): SpeakerPair => ({
  id: group.id,
  name: group.name,
  masterDeviceID: group.masterDeviceId,
  roles: group.roles.map(({ deviceId, role }) => ({
    deviceID: deviceId,
    role,
  })),
});

const isRole = (value: unknown): value is PairRole =>
  value === "LEFT" || value === "RIGHT";

/** A stored pair, or `undefined` when it can't be read. */
export function parseSpeakerPair(value: unknown): SpeakerPair | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { id, name, masterDeviceID, roles } = value as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof masterDeviceID !== "string" ||
    masterDeviceID === "" ||
    !Array.isArray(roles)
  ) {
    return undefined;
  }
  const parsed: { deviceID: string; role: PairRole }[] = [];
  for (const entry of roles as unknown[]) {
    if (typeof entry !== "object" || entry === null) {
      return undefined;
    }
    const { deviceID, role } = entry as Record<string, unknown>;
    if (typeof deviceID !== "string" || deviceID === "" || !isRole(role)) {
      return undefined;
    }
    parsed.push({ deviceID, role });
  }
  return parsed.some((role) => role.deviceID === masterDeviceID)
    ? { id, name, masterDeviceID, roles: parsed }
    : undefined;
}

/** The pair's speakers other than its master. */
export const partnersOf = (pair: SpeakerPair): string[] =>
  pair.roles
    .map((role) => role.deviceID)
    .filter((deviceID) => deviceID !== pair.masterDeviceID);

/** The pair `speaker` is the master of, whose card stands for both speakers. */
export const pairLedBy = (speaker: {
  deviceID: string;
  pair?: SpeakerPair;
}): SpeakerPair | undefined =>
  speaker.pair?.masterDeviceID === speaker.deviceID ? speaker.pair : undefined;

/** Where a listed speaker's settings open: the pair's own screen for its master. */
export const settingsPath = (speaker: {
  deviceID: string;
  pair?: SpeakerPair;
}) =>
  pairLedBy(speaker)
    ? (`/speakers/${encodeURIComponent(speaker.deviceID)}/pair` as const)
    : (`/speakers/${encodeURIComponent(speaker.deviceID)}/settings` as const);

/**
 * A pair's card in a few words, for the line under its name; nothing for a
 * speaker on its own.
 */
export const pairSummary = (
  speaker: Pick<BoseSpeaker, "deviceID" | "pair" | "pairStatus">,
): string | undefined => {
  if (!pairLedBy(speaker)) {
    return undefined;
  }
  return isPartnerUnreachable(speaker) ? "Partner unreachable" : "Stereo pair";
};

export const roleOf = (
  pair: SpeakerPair,
  deviceID: string,
): PairRole | undefined =>
  pair.roles.find((role) => role.deviceID === deviceID)?.role;

export const roleLabel = (role: PairRole): string =>
  role === "LEFT" ? "Left" : "Right";

/** The speaker reports its partner gone (the master goes to standby soon). */
export const isPartnerUnreachable = (
  speaker: Pick<BoseSpeaker, "pairStatus">,
): boolean => speaker.pairStatus === "GROUP_ERROR";

/** A new pair's suggested name: "<left> + <right>", within the cap. */
export const defaultPairName = (left: string, right: string): string =>
  `${left} + ${right}`.slice(0, PAIR_NAME_MAX_LENGTH).trim();

/** Why `name` can't name a pair, if it can't. */
export function validatePairName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === "") {
    return "Enter a name for the pair.";
  }
  if (trimmed.length > PAIR_NAME_MAX_LENGTH) {
    return `Use at most ${PAIR_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/** Whether `/getZone` says the speaker plays in a multiroom zone. */
export const isInZone = (zone: ZoneResponse): boolean =>
  zone.master !== "" || zone.members.length > 0;

/** Why a speaker can't join a new pair. */
export type PairProblem =
  | "offline"
  | "noStereo"
  | "paired"
  | "checking"
  | "otherServer"
  | "noAccount"
  | "otherAccount"
  | "inZone";

/**
 * Why `speaker`, a SoundTouch 10, can't be in a new pair, if it can't:
 * it must be reached, able to play in stereo, in no pair, on our server with
 * a household account, and in no multiroom zone. `inZone` is what its
 * `/getZone` said; `undefined` while that's unknown.
 */
export function pairProblem(
  speaker: BoseSpeaker,
  inZone: boolean | undefined,
): PairProblem | undefined {
  if (speaker.status !== "online") {
    return "offline";
  }
  if (speaker.capabilities?.lrStereoCapable !== true) {
    return "noStereo";
  }
  if (speaker.pair !== undefined) {
    return "paired";
  }
  const { radio } = speaker;
  if (radio.kind === "checking") {
    return "checking";
  }
  if (
    (radio.kind !== "ready" && radio.kind !== "needsSetup") ||
    radio.through !== null
  ) {
    return "otherServer";
  }
  if (!isHouseholdAccountId(speaker.margeAccountUUID)) {
    return "noAccount";
  }
  if (inZone === undefined) {
    return "checking";
  }
  return inZone ? "inZone" : undefined;
}

/**
 * Why `candidate` can't pair with `speaker`, if it can't: its own problem,
 * or another household account than `speaker`'s.
 */
export function partnerProblem(
  speaker: BoseSpeaker,
  candidate: BoseSpeaker,
  inZone: boolean | undefined,
): PairProblem | undefined {
  return (
    pairProblem(candidate, inZone) ??
    (candidate.margeAccountUUID === speaker.margeAccountUUID
      ? undefined
      : "otherAccount")
  );
}

/** A pair problem in a few words, under the speaker's name. */
export const PAIR_PROBLEM_LABELS: Record<PairProblem, string> = {
  offline: "Offline",
  noStereo: "Can't play in stereo",
  paired: "Already in a stereo pair",
  checking: "Checking…",
  otherServer: "Uses another server",
  noAccount: "Not set up for Revive ST",
  otherAccount: "On another account",
  inZone: "Playing in a multiroom zone",
};
