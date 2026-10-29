/**
 * The music sources every account offers its speakers. Speakers copy them from
 * `/full` into their own `Sources.xml` at boot, and only play or save presets
 * for sources listed there.
 */
export interface MargeSource {
  readonly id: string;
  readonly name: SourceName;
  readonly providerId: number;
  readonly credential: string;
  readonly createdOn: string;
  readonly updatedOn: string;
  readonly sourceName: string;
  /** The `sourceAccount` the speaker's ContentItems carry for this source. */
  readonly username: (accountId: string) => string;
}

export type SourceName = "LOCAL_INTERNET_RADIO";

/**
 * Stations the app casts, played through the Orion adapter. Its id and
 * provider id are the ones speakers already stored, so they stay as they are.
 */
export const LOCAL_INTERNET_RADIO: MargeSource = {
  id: "1",
  name: "LOCAL_INTERNET_RADIO",
  providerId: 10003,
  credential: "",
  createdOn: "2012-09-19T12:43:00.000+00:00",
  updatedOn: "2012-09-19T12:43:00.000+00:00",
  sourceName: "Local Radio Source",
  username: (accountId) => accountId,
};

export const ACCOUNT_SOURCES: readonly MargeSource[] = [LOCAL_INTERNET_RADIO];

/** Ids a speaker's `<sourceid>` may carry for each source. */
const SOURCES_BY_ID: Readonly<Record<string, MargeSource>> = {
  "1": LOCAL_INTERNET_RADIO,
  LOCAL_INTERNET_RADIO,
};

const ORION_LOCATION =
  /(?:^|\/orion)\/station\?data=|^(?:https?:\/\/[^/]+)?\/custom\/v1\/playback\//;

/**
 * The source a preset or recent a speaker sends belongs to: by its
 * `<sourceid>`, else, for an id this server never handed out (one from the
 * Bose cloud, say), by the shape of its location.
 */
export const resolveSource = (
  sourceId: string,
  location: string,
): MargeSource | undefined =>
  SOURCES_BY_ID[sourceId] ??
  (ORION_LOCATION.test(location) ? LOCAL_INTERNET_RADIO : undefined);

/** The source a stored ContentItem's `source` names, if the account has it. */
export const sourceNamed = (name: string): MargeSource | undefined =>
  ACCOUNT_SOURCES.find((source) => source.name === name);

/** The providers speakers resolve `sourceproviderid`s against. */
export const SOURCE_PROVIDERS: readonly {
  readonly id: number;
  readonly name: SourceName;
  readonly createdOn: string;
}[] = [
  {
    id: 10003,
    name: "LOCAL_INTERNET_RADIO",
    createdOn: "2012-09-19T12:43:00.000+00:00",
  },
];
