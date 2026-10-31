import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const FILTERS_KEY = "radio_filters";
const QUERY_KEY = ["radio-filters"];

/** The Radio tab's country and language; kept across launches. */
export interface RadioFilters {
  /** ISO 3166-1 alpha-2 code, e.g. `FR`. */
  country: string | null;
  /** Radio Browser's language name, e.g. `french`. */
  language: string | null;
}

export type RadioFilterKind = keyof RadioFilters;

const NO_FILTERS: RadioFilters = { country: null, language: null };

async function loadFilters(): Promise<RadioFilters> {
  const stored = await AsyncStorage.getItem(FILTERS_KEY);
  if (!stored) {
    return NO_FILTERS;
  }
  return { ...NO_FILTERS, ...(JSON.parse(stored) as Partial<RadioFilters>) };
}

export function useRadioFilters() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: loadFilters });
}

export function useSetRadioFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kind,
      value,
    }: {
      kind: RadioFilterKind;
      value: string | null;
    }) => {
      const updated = { ...(await loadFilters()), [kind]: value };
      await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}
