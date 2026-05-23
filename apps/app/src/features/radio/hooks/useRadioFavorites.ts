import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RadioStation } from "./useRadioStations";

const FAVORITES_KEY = "radio_favorites";

async function loadFavorites(): Promise<RadioStation[]> {
  const stored = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!stored) {
    return [];
  }
  return JSON.parse(stored) as RadioStation[];
}

async function saveFavorites(list: RadioStation[]): Promise<RadioStation[]> {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  return list;
}

export function useRadioFavorites() {
  return useQuery({
    queryKey: ["radio-favorites"],
    queryFn: loadFavorites,
  });
}

export function useRadioToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      station,
      isFavorite,
    }: {
      station: RadioStation;
      isFavorite: boolean;
    }) => {
      const current = await loadFavorites();
      const updated = isFavorite
        ? current.filter((fav) => fav.stationuuid !== station.stationuuid)
        : [...current, station];
      return saveFavorites(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["radio-favorites"], data);
    },
  });
}
