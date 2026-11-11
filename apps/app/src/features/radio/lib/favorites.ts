import type { RadioStation } from "./radio-browser";

/** Where favorites are kept: AsyncStorage in the app, a fake in tests. */
export interface FavoritesStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export const FAVORITES_KEY = "radio_favorites";

/**
 * Reads the stored favorites list. Unreadable data gives an empty list, and
 * later duplicates are dropped so lists stored by older versions heal.
 */
export function parseFavorites(stored: string | null): RadioStation[] {
  if (stored === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const seen = new Set<string>();
  const list: RadioStation[] = [];
  for (const entry of parsed as unknown[]) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      "stationuuid" in entry &&
      typeof entry.stationuuid === "string" &&
      !seen.has(entry.stationuuid)
    ) {
      seen.add(entry.stationuuid);
      // The entry has the shape the app stored; only stationuuid is checked.
      list.push(entry as RadioStation);
    }
  }
  return list;
}

/** Returns the list with the station favorited or not, never listing it twice. */
export function withFavorite(
  list: readonly RadioStation[],
  station: RadioStation,
  favorite: boolean,
): RadioStation[] {
  if (!favorite) {
    return list.filter((fav) => fav.stationuuid !== station.stationuuid);
  }
  if (list.some((fav) => fav.stationuuid === station.stationuuid)) {
    return [...list];
  }
  return [...list, station];
}

/**
 * Loads and changes favorites. Changes run one after another, each from the
 * latest stored list, so quick toggles never overwrite each other.
 */
export function createFavoritesStore(storage: FavoritesStorage) {
  let queue: Promise<unknown> = Promise.resolve();

  const load = async (): Promise<RadioStation[]> =>
    parseFavorites(await storage.getItem(FAVORITES_KEY));

  return {
    load,
    setFavorite: async (
      station: RadioStation,
      favorite: boolean,
    ): Promise<RadioStation[]> => {
      const run = queue.then(async () => {
        const updated = withFavorite(await load(), station, favorite);
        await storage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        return updated;
      });
      // The next write waits for this one, whether it succeeds or fails.
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
