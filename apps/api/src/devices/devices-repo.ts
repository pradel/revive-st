import { and, asc, eq, sql } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database } from "../db/database.ts";
import { devicesTable } from "../db/schema.ts";
import type { AccountId } from "../marge/account.ts";
import { DeviceId } from "../presets/preset.ts";

const decodeDeviceIds = Schema.decodeUnknownEffect(Schema.Array(DeviceId));

/**
 * The most speakers one account can be paired with: more than any household
 * has, and few enough that an account id, which anyone can make up, can't be
 * used to store unlimited presets.
 */
export const MAX_DEVICES_PER_ACCOUNT = 50;

/**
 * The speakers paired with each account. Pairing only ever adds a speaker to
 * an account: anyone can name a speaker's device id (its MAC address), so
 * pairing it elsewhere must not drop it from its household's account, which
 * would unpair it and wipe its presets at its next boot.
 */
export class DevicesRepo extends Context.Service<
  DevicesRepo,
  {
    /**
     * Pairs `deviceId` with `accountId` unless the account already has
     * `MAX_DEVICES_PER_ACCOUNT` speakers. Whether the device is paired.
     */
    readonly pair: (
      accountId: AccountId,
      deviceId: DeviceId,
    ) => Effect.Effect<boolean>;
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
        // One statement, so concurrent pairings can't overfill the account.
        yield* db.run(sql`
          INSERT INTO devices (account_id, device_id, paired_on)
          SELECT ${accountId}, ${deviceId}, ${now}
          WHERE (SELECT count(*) FROM devices WHERE account_id = ${accountId})
            < ${MAX_DEVICES_PER_ACCOUNT}
          ON CONFLICT DO NOTHING
        `);
        const [row] = yield* db
          .select({ deviceId: devicesTable.deviceId })
          .from(devicesTable)
          .where(
            and(
              eq(devicesTable.accountId, accountId),
              eq(devicesTable.deviceId, deviceId),
            ),
          );
        if (row === undefined) {
          // Never log the account id: it guards the household's presets.
          yield* Effect.logWarning("Account full: speaker not paired", {
            deviceId,
          });
        }
        return row !== undefined;
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
