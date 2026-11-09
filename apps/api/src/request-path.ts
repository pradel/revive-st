/** The path only: query strings carry encoded station data. */
export const pathOf = (url: string) => url.split("?", 1)[0];

/** The `/account/:accountId` segment of Marge and app paths. */
export const ACCOUNT_SEGMENT = /(\/account\/)([^/]+)/;

const decodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/** The account id `path` names, decoded, if it names one. */
export const accountIdOf = (path: string) => {
  const segment = ACCOUNT_SEGMENT.exec(path)?.[2];
  return segment === undefined ? undefined : decodePathSegment(segment);
};
