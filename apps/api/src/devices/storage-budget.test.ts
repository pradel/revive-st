import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";

import { Database, StorageBudget } from "../db/database.ts";
import { deviceContactsTable, devicesTable } from "../db/schema.ts";
import { AccountId } from "../marge/account.ts";
import { DeviceId } from "../presets/preset.ts";
import { DeviceContactsRepo } from "./device-contacts-repo.ts";
import { DevicesRepo } from "./devices-repo.ts";

/** A database already past its budget, with room left under SQLite's limit. */
const OverBudget = Layer.mergeAll(
  DevicesRepo.layerNoDeps,
  DeviceContactsRepo.layerNoDeps,
).pipe(
  Layer.provideMerge(
    Database.layerTestWith(
      StorageBudget.of({ softBytes: 0, hardBytes: 64 * 1024 * 1024 }),
    ),
  ),
);

const ACCOUNT = AccountId.make("household");
const KNOWN = DeviceId.make("EC1127C25A50");
const NEW = DeviceId.make("EC1127C25A51");

describe("past the storage budget", () => {
  it.effect("keeps paired speakers and pairs no new one", () =>
    Effect.gen(function* () {
      const db = yield* Database;
      yield* db
        .insert(devicesTable)
        .values({ accountId: ACCOUNT, deviceId: KNOWN, pairedOn: 0 });
      const devices = yield* DevicesRepo;

      assert.strictEqual(yield* devices.pair(ACCOUNT, KNOWN), "paired");
      assert.strictEqual(yield* devices.pair(ACCOUNT, NEW), "storageFull");
      assert.deepStrictEqual(yield* devices.findByAccount(ACCOUNT), [KNOWN]);
    }).pipe(Effect.provide(OverBudget)),
  );

  it.effect("updates known speakers' contacts and records no new one", () =>
    Effect.gen(function* () {
      const db = yield* Database;
      yield* db
        .insert(deviceContactsTable)
        .values({ deviceId: KNOWN, lastContactAt: 0 });
      const contacts = yield* DeviceContactsRepo;

      yield* TestClock.adjust("1 second");
      yield* contacts.record(KNOWN);
      yield* contacts.record(NEW);
      assert.strictEqual(yield* contacts.lastContactAt(KNOWN), 1000);
      assert.isUndefined(yield* contacts.lastContactAt(NEW));
    }).pipe(Effect.provide(OverBudget)),
  );
});
