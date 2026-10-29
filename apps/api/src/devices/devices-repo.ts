import { asc, eq, sql } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database } from "../db/database.ts";
import { devicesTable } from "../db/schema.ts";
import type { AccountId } from "../marge/account.ts";
import { DeviceId } from "../presets/preset.ts";

const decodeDeviceIds = Schema.decodeUnknownEffect(Schema.Array(DeviceId));

/** Which account each speaker is paired with: one at a time. */
export class DevicesRepo extends Context.Service<
  DevicesRepo,
  {
    /**
     * Records that `deviceId` is paired with `accountId`, moving it out of
     * any account it was paired with before.
     */
    readonly pair: (
      accountId: AccountId,
      deviceId: DeviceId,
    ) => Effect.Effect<void>;
    /** The devices paired with `accountId`, oldest pairing first. */
    readonly findByAccount: (
      accountId: AccountId,
    ) => Effect.Effect<readonly DeviceId[]>;
  }
>()("@revive-st/api/devices/DevicesRepo") {
  static readonly layerNoDeps = Layer.effect(
    DevicesRepo,
    Effect.gen(function* () {
      const db = yield* Database;

      const pair = Effect.fn("DevicesRepo.pair")(function* (
        accountId: AccountId,
        deviceId: DeviceId,
      ) {
        const now = DateTime.toEpochMillis(yield* DateTime.now);
        yield* db
          .insert(devicesTable)
          .values({ deviceId, accountId, pairedOn: now })
          .onConflictDoUpdate({
            target: devicesTable.deviceId,
            set: {
              accountId: sql`excluded.account_id`,
              pairedOn: sql`excluded.paired_on`,
            },
            // Pairing again with the same account keeps the original date.
            setWhere: sql`${devicesTable.accountId} <> excluded.account_id`,
          });
      }, Effect.orDie);

      const findByAccount = Effect.fn("DevicesRepo.findByAccount")(function* (
        accountId: AccountId,
      ) {
        const rows = yield* db
          .select({ deviceId: devicesTable.deviceId })
          .from(devicesTable)
          .where(eq(devicesTable.accountId, accountId))
          .orderBy(asc(devicesTable.pairedOn), asc(devicesTable.deviceId));
        return yield* decodeDeviceIds(rows.map((row) => row.deviceId));
      }, Effect.orDie);

      return DevicesRepo.of({ pair, findByAccount });
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(Database.layer));

  static readonly layerTest = this.layerNoDeps.pipe(
    Layer.provide(Database.layerTest),
  );
}
