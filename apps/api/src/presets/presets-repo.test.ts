import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";

import { Database } from "../db/database.ts";
import { presetsTable } from "../db/schema.ts";
import {
  ContentItem,
  DeviceId,
  Preset,
  PresetId,
  type StoredPreset,
} from "./preset.ts";
import { PresetsRepo } from "./presets-repo.ts";

const deviceA = DeviceId.make("device-a");
const deviceB = DeviceId.make("device-b");

const preset = (
  id: number,
  itemName: string,
  timestamps: { createdOn?: number; updatedOn?: number } = {},
) =>
  new Preset({
    id: PresetId.make(id),
    ...timestamps,
    contentItem: new ContentItem({
      source: "LOCAL_INTERNET_RADIO",
      type: "stationurl",
      location: `https://example.com/${itemName}`,
      sourceAccount: "revivest-user",
      isPresetable: id % 2 === 1,
      itemName,
      containerArt: `https://example.com/${itemName}.png`,
    }),
  });

/** The read-back shape of {@link preset}. */
const storedPreset = (
  id: number,
  itemName: string,
  timestamps: { createdOn: number; updatedOn: number },
): StoredPreset => ({
  id,
  ...timestamps,
  contentItem: preset(id, itemName).contentItem,
});

describe("PresetsRepo", () => {
  it.effect("round-trips presets per device, ordered by id", () =>
    Effect.gen(function* () {
      const repo = yield* PresetsRepo;
      yield* TestClock.setTime(1_000);
      yield* repo.upsert(deviceA, [preset(3, "three"), preset(1, "one")]);
      yield* repo.upsert(deviceB, [preset(1, "other")]);

      assert.deepStrictEqual(yield* repo.findByDevice(deviceA), [
        storedPreset(1, "one", { createdOn: 1_000, updatedOn: 1_000 }),
        storedPreset(3, "three", { createdOn: 1_000, updatedOn: 1_000 }),
      ]);
      assert.deepStrictEqual(
        (yield* repo.findByDevice(deviceB)).map(
          (stored) => stored.contentItem.itemName,
        ),
        ["other"],
      );
    }).pipe(Effect.provide(PresetsRepo.layerTest)),
  );

  it.effect(
    "replaces a preset, keeping its stored createdOn and refreshing updatedOn",
    () =>
      Effect.gen(function* () {
        const repo = yield* PresetsRepo;
        yield* TestClock.setTime(1_000);
        yield* repo.upsert(deviceA, [preset(2, "before", { createdOn: 500 })]);
        yield* TestClock.setTime(5_000);
        yield* repo.upsert(deviceA, [preset(2, "after", { createdOn: 4_000 })]);

        const [stored] = yield* repo.findByDevice(deviceA);
        assert.strictEqual(stored.createdOn, 500);
        assert.strictEqual(stored.updatedOn, 5_000);
        assert.deepStrictEqual(
          stored.contentItem,
          preset(2, "after").contentItem,
        );
      }).pipe(Effect.provide(PresetsRepo.layerTest)),
  );

  it.effect("ignores an empty upsert", () =>
    Effect.gen(function* () {
      const repo = yield* PresetsRepo;
      yield* repo.upsert(deviceA, []);
      assert.deepStrictEqual(yield* repo.findByDevice(deviceA), []);
    }).pipe(Effect.provide(PresetsRepo.layerTest)),
  );

  it.effect("reads rows written before preset ids and types were tracked", () =>
    Effect.gen(function* () {
      const db = yield* Database;
      yield* db.insert(presetsTable).values({
        deviceId: deviceA,
        presetId: 9,
        source: "TUNEIN",
        location: "s123",
        sourceAccount: "",
        isPresetable: true,
        itemName: "Legacy",
      });
      const repo = yield* PresetsRepo;
      const [stored] = yield* repo.findByDevice(deviceA);
      assert.strictEqual(stored.id, 9);
      assert.strictEqual(stored.contentItem.itemName, "Legacy");
      assert.strictEqual(stored.contentItem.type, "stationurl");
      assert.strictEqual(stored.contentItem.containerArt, "");
    }).pipe(
      Effect.provide(
        PresetsRepo.layerNoDeps.pipe(Layer.provideMerge(Database.layerTest)),
      ),
    ),
  );
});
