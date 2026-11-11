import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createFavoritesStore } from "../lib/favorites";
import type { RadioStation } from "../lib/radio-browser";

const QUERY_KEY = ["radio-favorites"];

// One store for the whole app, so every write waits in the same queue.
const store = createFavoritesStore(AsyncStorage);

export function useRadioFavorites() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => store.load(),
  });
}

export function useRadioToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      station,
      favorite,
    }: {
      station: RadioStation;
      favorite: boolean;
    }) => store.setFavorite(station, favorite),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}
