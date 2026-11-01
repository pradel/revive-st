import { and, asc, eq, sql } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database, hasRoom, StorageBudget } from "../db/database.ts";
import { devicesTable } from "../db/schema.ts";
import type { AccountId } from "../marge/account.ts";
import { DeviceId } from "../presets/preset.ts";

const decodeDeviceIds = Schema.decodeUnknownEffect(Schema.Array(DeviceId));

/**
 * The most speakers one account can be paired with: more than any household
 * has, and few enough that an account id, which anyone can make up, can't be
 * used to store unlimited presets, nor make its `/full` document large.
 */
export const MAX_DEVICES_PER_ACCOUNT = 20;

/**
 * Whether a speaker is paired with an account: it is, the account already
 * has `MAX_DEVICES_PER_ACCOUNT` others, or the database is past its
 * `StorageBudget` and takes no new speaker.
 */
export type Pairing = "paired" | "accountFull" | "storageFull";

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
     * Pairs `deviceId` with `accountId` unless the account is full or the
     * database past its budget. A speaker already paired stays paired.
     */
    readonly pair: (
      accountId: AccountId,
      deviceId: DeviceId,
    ) => Effect.Effect<Pairing>;
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
      const { softBytes } = yield* StorageBudget;

      const accountSize = (accountId: AccountId) =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(devicesTable)
          .where(eq(devicesTable.accountId, accountId))
          .pipe(Effect.map(([row]) => row?.count ?? 0));

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
            AND ${hasRoom(softBytes)}
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
        if (row !== undefined) {
          return "paired";
        }
        // Never log the account id: it guards the household's presets.
        if ((yield* accountSize(accountId)) >= MAX_DEVICES_PER_ACCOUNT) {
          yield* Effect.logWarning("Account full: speaker not paired", {
            deviceId,
          });
          return "accountFull";
        }
        yield* Effect.logWarning("Storage budget reached: speaker not paired", {
          deviceId,
          softBytes,
        });
        return "storageFull";
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
