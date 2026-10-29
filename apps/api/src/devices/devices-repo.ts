import { asc, eq } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database } from "../db/database.ts";
import { devicesTable } from "../db/schema.ts";
import type { AccountId } from "../marge/account.ts";
import { DeviceId } from "../presets/preset.ts";

const decodeDeviceIds = Schema.decodeUnknownEffect(Schema.Array(DeviceId));

/**
 * The speakers paired with each account. Pairing only ever adds a speaker to
 * an account: anyone can name a speaker's device id (its MAC address), so
 * pairing it elsewhere must not drop it from its household's account, which
 * would unpair it and wipe its presets at its next boot.
 */
export class DevicesRepo extends Context.Service<
  DevicesRepo,
  {
    /** Records that `deviceId` is paired with `accountId`. */
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
          .values({ accountId, deviceId, pairedOn: now })
          .onConflictDoNothing();
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
