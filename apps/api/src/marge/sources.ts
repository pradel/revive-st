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

export type SourceName = "LOCAL_INTERNET_RADIO" | "TUNEIN";

/** Stations the app casts, played through the Orion adapter. */
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

/**
 * TuneIn stations, played through the TuneIn adapter. The credential is
 * token-shaped (base64 of `{"serial":"tunein"}`): speakers refuse a source
 * whose token is empty.
 */
export const TUNEIN: MargeSource = {
  id: "10004",
  name: "TUNEIN",
  providerId: 25,
  credential: "eyJzZXJpYWwiOiJ0dW5laW4ifQ==",
  createdOn: "2017-07-20T16:43:48.000+00:00",
  updatedOn: "2017-07-20T16:43:48.000+00:00",
  sourceName: "",
  username: () => "",
};

export const ACCOUNT_SOURCES: readonly MargeSource[] = [
  LOCAL_INTERNET_RADIO,
  TUNEIN,
];

/**
 * The source a preset or recent a speaker sends belongs to, by its
 * `<sourceid>`: the id the speaker copied from `/full`, or, as firmware sends
 * for TuneIn, the source's name.
 */
export const sourceWithId = (sourceId: string): MargeSource | undefined =>
  ACCOUNT_SOURCES.find(
    (source) => source.id === sourceId || source.name === sourceId,
  );

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
  { id: 25, name: "TUNEIN", createdOn: "2016-04-08T17:27:21.000+00:00" },
];
