/** The path only: query strings carry encoded station data. */
export const pathOf = (url: string) => url.split("?", 1)[0];

/**
 * The path `url` names as Effect's router matches it (`FindMyWay`): an
 * absolute URL's origin and anything from `?`, `;` or `#` dropped,
 * percent-encoding decoded except for reserved characters, duplicate and
 * trailing slashes removed. The router also ignores case, so compare with
 * this path lowercased.
 */
export const routedPathOf = (url: string) => {
  const path = url.replace(/^https?:\/\/.*?\//, "/").split(/[?;#]/, 1)[0];
  let decoded = path;
  try {
    // `%25` stays encoded, as the router keeps it, so no `%` is decoded twice.
    decoded = decodeURI(path.replaceAll("%25", "%2525"));
  } catch {
    // The router matches no route for a malformed path.
  }
  const collapsed = decoded.replace(/\/\/+/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/")
    ? collapsed.slice(0, -1)
    : collapsed;
};

/** The `/account/:accountId` segment of Marge and app paths. */
export const ACCOUNT_SEGMENT = /(\/account\/)([^/]+)/;

/** `segment` percent-decoded, or as it is when it is malformed. */
const decodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * The account id `url` names, decoded, if the route it reaches names one: the
 * `account` segment is matched as the router matches it, in any case.
 */
export const accountIdOf = (url: string) => {
  const segment = /\/account\/([^/]+)/i.exec(routedPathOf(url))?.[1];
  return segment === undefined ? undefined : decodePathSegment(segment);
};
