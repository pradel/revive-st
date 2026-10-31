/**
 * Radio Browser's API. The name resolves to one of its servers at random, so
 * a failed request (retried by TanStack Query) likely lands on another one.
 */
const API_URL = "https://all.api.radio-browser.info/json";

/** Radio Browser asks clients to identify themselves. */
const HEADERS = { "User-Agent": "ReviveST/1.0 (+https://www.revivest.app)" };

/** A server that accepts the connection but never answers moves on to the next try. */
const REQUEST_TIMEOUT_MS = 8000;

export const STATIONS_PAGE_SIZE = 30;

export interface RadioStation {
  changeid: string;
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  codec: string;
  bitrate: number;
  /** `1` when the stream is HLS, which SoundTouch speakers can't play. */
  hls: number;
}

/** What to search for; every set field narrows the results. */
export interface StationFilters {
  query: string;
  tag: string | null;
  /** ISO 3166-1 alpha-2 code, e.g. `FR`. */
  countryCode: string | null;
  /** Radio Browser's lowercase language name, e.g. `french`. */
  language: string | null;
}

export interface StationsPage {
  stations: RadioStation[];
  /** Offset of the next page; absent on the last one. */
  nextOffset?: number;
}

export interface RadioCountry {
  /** ISO 3166-1 alpha-2 code, e.g. `FR`. */
  code: string;
  /** Display name, e.g. `United States Of America`. */
  name: string;
  stationCount: number;
}

export interface RadioLanguage {
  /** Radio Browser's name, which the search matches, e.g. `french`. */
  name: string;
  /** Display name, e.g. `French`. */
  label: string;
  /** ISO 639-1 code when Radio Browser knows it, e.g. `fr`. */
  code: string | null;
  stationCount: number;
}

async function getJson<Body>(
  path: string,
  signal?: AbortSignal,
): Promise<Body> {
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
  };
  signal?.addEventListener("abort", abort);
  const timeoutId = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Radio Browser answered ${res.status}`);
    }
    return (await res.json()) as Body;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}

/** SoundTouch speakers can't play HLS streams; our server refuses them too. */
export const isPlayable = (station: RadioStation) => station.hls === 0;

/**
 * One page of stations matching every filter, most played in the last day
 * first. Stations a speaker can't play are left out, so a page can hold fewer
 * than `STATIONS_PAGE_SIZE` stations without being the last.
 */
export async function searchStations(
  filters: StationFilters,
  offset: number,
  signal?: AbortSignal,
): Promise<StationsPage> {
  const params = new URLSearchParams({
    limit: String(STATIONS_PAGE_SIZE),
    offset: String(offset),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });
  const query = filters.query.trim();
  if (query) {
    params.set("name", query);
  }
  if (filters.tag) {
    params.set("tag", filters.tag.toLowerCase());
  }
  if (filters.countryCode) {
    params.set("countrycode", filters.countryCode);
  }
  if (filters.language) {
    params.set("language", filters.language);
    params.set("languageExact", "true");
  }
  const stations = await getJson<RadioStation[]>(
    `/stations/search?${params.toString()}`,
    signal,
  );
  return {
    stations: stations.filter(isPlayable),
    nextOffset:
      stations.length < STATIONS_PAGE_SIZE
        ? undefined
        : offset + STATIONS_PAGE_SIZE,
  };
}

const byName = new Intl.Collator().compare;

/** Countries with stations, by name; codes Radio Browser can't name are left out. */
export async function fetchCountries(
  signal?: AbortSignal,
): Promise<RadioCountry[]> {
  const countries = await getJson<
    { name: string; iso_3166_1: string; stationcount: number }[]
  >("/countries?hidebroken=true", signal);
  return countries
    .filter((country) => country.iso_3166_1 && country.name)
    .map((country) => ({
      code: country.iso_3166_1,
      // Radio Browser names some countries "The United States Of America".
      name: country.name.replace(/^The /, ""),
      stationCount: country.stationcount,
    }))
    .sort((a, b) => byName(a.name, b.name));
}

/**
 * Languages with enough stations to be worth a filter, by name. Radio
 * Browser's list is free text, so it also holds typos and one-off spellings.
 */
export async function fetchLanguages(
  signal?: AbortSignal,
): Promise<RadioLanguage[]> {
  const languages = await getJson<
    { name: string; iso_639: string | null; stationcount: number }[]
  >("/languages?hidebroken=true", signal);
  return languages
    .filter((language) => language.stationcount >= 20)
    .map((language) => ({
      name: language.name,
      label: language.name.replaceAll(/(^|\s)\S/g, (letter) =>
        letter.toUpperCase(),
      ),
      code: language.iso_639,
      stationCount: language.stationcount,
    }))
    .sort((a, b) => byName(a.label, b.label));
}

/**
 * Counts a play towards the station's popularity, as Radio Browser asks
 * clients to whenever a user starts a station.
 */
export async function countStationClick(stationuuid: string) {
  await getJson(`/url/${encodeURIComponent(stationuuid)}`);
}
