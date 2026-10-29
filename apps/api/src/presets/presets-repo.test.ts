import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { AccountId } from "../marge/account.ts";
import { ContentItem, DeviceId, Preset, PresetId } from "./preset.ts";
import { PresetsRepo } from "./presets-repo.ts";

const household = AccountId.make("household");
const neighbour = AccountId.make("neighbour");
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
      sourceAccount: "household",
      isPresetable: id % 2 === 1,
      itemName,
      containerArt: `https://example.com/${itemName}.png`,
    }),
  });

describe("PresetsRepo", () => {
  it.effect("round-trips presets per device, ordered by id", () =>
    Effect.gen(function* () {
      const repo = yield* PresetsRepo;
      yield* TestClock.setTime(1_000);
      yield* repo.upsert(household, deviceA, [
        preset(3, "three"),
        preset(1, "one"),
      ]);
      yield* repo.upsert(household, deviceB, [preset(1, "other")]);

      assert.deepStrictEqual(yield* repo.findByDevice(household, deviceA), [
        preset(1, "one", { createdOn: 1_000, updatedOn: 1_000 }),
        preset(3, "three", { createdOn: 1_000, updatedOn: 1_000 }),
      ]);
      assert.deepStrictEqual(
        (yield* repo.findByDevice(household, deviceB)).map(
          (stored) => stored.contentItem.itemName,
        ),
        ["other"],
      );
    }).pipe(Effect.provide(PresetsRepo.layerTest)),
  );

  it.effect("keeps one device's presets apart in each account", () =>
    Effect.gen(function* () {
      const repo = yield* PresetsRepo;
      yield* repo.upsert(household, deviceA, [preset(1, "ours")]);
      yield* repo.upsert(neighbour, deviceA, [preset(1, "theirs")]);

      const names = (presets: readonly Preset[]) =>
        presets.map((stored) => stored.contentItem.itemName);
      assert.deepStrictEqual(
        names(yield* repo.findByDevice(household, deviceA)),
        ["ours"],
      );
      assert.deepStrictEqual(
        names(yield* repo.findByDevice(neighbour, deviceA)),
        ["theirs"],
      );
    }).pipe(Effect.provide(PresetsRepo.layerTest)),
  );

  it.effect(
    "replaces a preset, keeping its stored createdOn and refreshing updatedOn",
    () =>
      Effect.gen(function* () {
        const repo = yield* PresetsRepo;
        yield* TestClock.setTime(1_000);
        yield* repo.upsert(household, deviceA, [
          preset(2, "before", { createdOn: 500 }),
        ]);
        yield* TestClock.setTime(5_000);
        yield* repo.upsert(household, deviceA, [
          preset(2, "after", { createdOn: 4_000 }),
        ]);

        const [stored] = yield* repo.findByDevice(household, deviceA);
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
      yield* repo.upsert(household, deviceA, []);
      assert.deepStrictEqual(yield* repo.findByDevice(household, deviceA), []);
    }).pipe(Effect.provide(PresetsRepo.layerTest)),
  );
});
