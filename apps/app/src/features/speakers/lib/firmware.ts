/**
 * The release of a SoundTouch software version string, e.g. "27.0.6" from
 * "27.0.6.46330.5043500 epdbuild.trunk.hepdswbld04.2022-08-04T11:20:29".
 * Strings that don't start with a dotted version are returned as they are.
 */
export function shortVersion(version: string): string {
  const [first = ""] = version.trim().split(/\s+/);
  const match = /^\d+(?:\.\d+){0,2}/.exec(first);
  return match ? match[0] : version.trim();
}
