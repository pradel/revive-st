/** What a Revive ST server's `GET /` names itself (`SERVER_NAME` in `apps/api`). */
export const REVIVE_SERVER_NAME = "Revive ST API";

/**
 * The oldest server release this app works with, a release without a
 * prerelease tag. The app and the server are released separately, and a
 * self-hosted server can stay on an old release while the app updates: raise
 * this when the app starts relying on something a server release added (an
 * internal endpoint, or a Marge or BMX answer).
 */
export const MIN_SERVER_VERSION = "0.0.3";

/** What a server's `GET /` tells the app about it. */
export type ServerCheck =
  | { readonly kind: "supported"; readonly version: string }
  | { readonly kind: "notRevive" }
  /** `version` is `null` when the server didn't report one. */
  | { readonly kind: "tooOld"; readonly version: string | null };

/** A too-old server's release, as copy says it: "runs …". */
export const oldRelease = (version: string | null) =>
  version === null ? "an old release of Revive ST" : `Revive ST ${version}`;

const RELEASE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/**
 * Whether `version` is `minimum` or newer, by semver precedence: a prerelease
 * comes before its release. `minimum` is a release; a `version` that isn't
 * one isn't newer than anything.
 */
export function isAtLeast(version: string, minimum: string): boolean {
  const have = RELEASE.exec(version);
  const need = RELEASE.exec(minimum);
  if (!have || !need) {
    return false;
  }
  for (let part = 1; part <= 3; part++) {
    const difference = Number(have[part]) - Number(need[part]);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return have[4] === undefined;
}

/** Judges the body of a server's `GET /` against `minimum`. */
export function checkServerStatus(
  status: unknown,
  minimum = MIN_SERVER_VERSION,
): ServerCheck {
  if (typeof status !== "object" || status === null) {
    return { kind: "notRevive" };
  }
  const { name, version } = status as Record<string, unknown>;
  if (name !== REVIVE_SERVER_NAME) {
    return { kind: "notRevive" };
  }
  if (typeof version !== "string") {
    return { kind: "tooOld", version: null };
  }
  return isAtLeast(version, minimum)
    ? { kind: "supported", version }
    : { kind: "tooOld", version };
}
