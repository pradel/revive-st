import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  fetchCountries,
  fetchLanguages,
  searchStations,
  type StationFilters,
} from "../lib/radio-browser";

/** Countries and languages barely change; a day keeps the pickers instant. */
const FILTER_OPTIONS_STALE_MS = 24 * 60 * 60 * 1000;

/** Stations matching `filters`, a page at a time; idle until they're known. */
export function useRadioStations(filters: StationFilters | null) {
  return useInfiniteQuery({
    queryKey: ["radio-stations", filters],
    queryFn: async ({ pageParam, signal }) =>
      searchStations(filters!, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: filters !== null,
  });
}

/** The most played stations in a country right now; idle without one. */
export function usePopularStations(countryCode: string | null) {
  return useQuery({
    queryKey: ["radio-popular", countryCode],
    queryFn: async ({ signal }) => {
      const page = await searchStations(
        { query: "", tag: null, countryCode, language: null },
        0,
        signal,
      );
      return page.stations;
    },
    enabled: countryCode !== null,
  });
}

export function useRadioCountries() {
  return useQuery({
    queryKey: ["radio-countries"],
    queryFn: async ({ signal }) => fetchCountries(signal),
    staleTime: FILTER_OPTIONS_STALE_MS,
  });
}

export function useRadioLanguages() {
  return useQuery({
    queryKey: ["radio-languages"],
    queryFn: async ({ signal }) => fetchLanguages(signal),
    staleTime: FILTER_OPTIONS_STALE_MS,
  });
}
