import type { SpeakerGroup, ZoneResponse } from "bose-api-speaker-client";

import type { BoseSpeaker } from "../registry/types";
import { isHouseholdAccountId, isSameOrigin } from "./account-id";

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
  // One LEFT and one RIGHT speaker, distinct, the master one of them.
  const [first, second] = parsed;
  return parsed.length === 2 &&
    first !== undefined &&
    second !== undefined &&
    first.deviceID !== second.deviceID &&
    first.role !== second.role &&
    parsed.some((role) => role.deviceID === masterDeviceID)
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

/**
 * For a pair's master that isn't reached, a partner still in its pair that
 * is: its own settings still answer.
 */
export const reachedPartner = (
  speaker: Pick<BoseSpeaker, "deviceID" | "pair" | "status">,
  all: readonly Pick<BoseSpeaker, "deviceID" | "pair" | "status">[],
): string | undefined => {
  const pair = pairLedBy(speaker);
  if (pair === undefined || speaker.status === "online") {
    return undefined;
  }
  return partnersOf(pair).find((id) =>
    all.some(
      (other) =>
        other.deviceID === id &&
        other.status === "online" &&
        other.pair?.id === pair.id,
    ),
  );
};

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

export const roleLabel = (role: PairRole): string =>
  role === "LEFT" ? "Left" : "Right";

/** The speaker reports its partner gone (the master goes to standby soon). */
export const isPartnerUnreachable = (
  speaker: Pick<BoseSpeaker, "pairStatus">,
): boolean => speaker.pairStatus === "GROUP_ERROR";

/** A new pair's suggested name: "<left> + <right>", within the cap. */
export const defaultPairName = (left: string, right: string): string => {
  // Whole characters only: an emoji takes two of the 64.
  let name = "";
  for (const character of `${left} + ${right}`) {
    if (name.length + character.length > PAIR_NAME_MAX_LENGTH) {
      break;
    }
    name += character;
  }
  return name.trim();
};

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
  | "inZone"
  | "zoneUnread";

/**
 * Why `speaker`, a SoundTouch 10, can't be in a new pair, if it can't:
 * it must be reached, able to play in stereo, in no pair, on our server with
 * a household account, and in no multiroom zone. `inZone` is what its
 * `/getZone` said; `undefined` while that's unknown, `null` when it didn't
 * answer.
 */
export function pairProblem(
  speaker: BoseSpeaker,
  inZone: boolean | null | undefined,
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
  // A radio kept from before the speaker moved to another server: its new
  // one is checked as soon as it reports it.
  if (!isSameOrigin(speaker.margeURL, radio.margeURL)) {
    return "checking";
  }
  if (!isHouseholdAccountId(speaker.margeAccountUUID)) {
    return "noAccount";
  }
  if (inZone === undefined) {
    return "checking";
  }
  if (inZone === null) {
    return "zoneUnread";
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
  inZone: boolean | null | undefined,
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
  zoneUnread: "Didn't say if it's in a multiroom zone",
};
