import { describe, expect, it } from "vite-plus/test";

import { createFavoritesStore, parseFavorites } from "./favorites";
import type { RadioStation } from "./radio-browser";

const station = (stationuuid: string): RadioStation => ({
  changeid: "",
  stationuuid,
  name: stationuuid,
  url: "",
  url_resolved: "",
  favicon: "",
  tags: "",
  country: "",
  codec: "MP3",
  bitrate: 128,
  hls: 0,
});

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    get value() {
      return value;
    },
    getItem: async () => {
      await Promise.resolve();
      return value;
    },
    setItem: async (_key: string, next: string) => {
      await Promise.resolve();
      value = next;
    },
  };
}

const uuids = (stored: string | null) =>
  parseFavorites(stored).map((fav) => fav.stationuuid);

describe("favorites", () => {
  const a = station("a");
  const b = station("b");

  it("keeps both stations starred at the same time", async () => {
    const storage = memoryStorage();
    const store = createFavoritesStore(storage);
    await Promise.all([store.setFavorite(a, true), store.setFavorite(b, true)]);
    expect(uuids(storage.value)).toEqual(["a", "b"]);
  });

  it("stores a station once when it's starred twice", async () => {
    const storage = memoryStorage();
    const store = createFavoritesStore(storage);
    await Promise.all([store.setFavorite(a, true), store.setFavorite(a, true)]);
    // The raw value: `parseFavorites` drops duplicates and would hide one.
    expect(storage.value).toBe(JSON.stringify([a]));
  });

  it("removes a station starred then unstarred in a row", async () => {
    const storage = memoryStorage();
    const store = createFavoritesStore(storage);
    await Promise.all([
      store.setFavorite(a, true),
      store.setFavorite(a, false),
    ]);
    expect(uuids(storage.value)).toEqual([]);
  });

  it("keeps writing after a failed write", async () => {
    const storage = memoryStorage();
    let failNext = true;
    const store = createFavoritesStore({
      getItem: storage.getItem,
      setItem: async (key, value) => {
        if (failNext) {
          failNext = false;
          throw new Error("disk full");
        }
        await storage.setItem(key, value);
      },
    });
    const first = store.setFavorite(a, true);
    const second = store.setFavorite(b, true);
    await expect(first).rejects.toThrow("disk full");
    await expect(second).resolves.toEqual([b]);
    expect(uuids(storage.value)).toEqual(["b"]);
  });

  it("reads lists the app stored before, and heals duplicates", () => {
    expect(uuids(JSON.stringify([a, a, b]))).toEqual(["a", "b"]);
  });

  it("reads an unreadable list as empty", () => {
    expect(parseFavorites("{not json")).toEqual([]);
    expect(parseFavorites("{}")).toEqual([]);
    expect(parseFavorites(null)).toEqual([]);
  });
});
