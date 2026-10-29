import { and, asc, eq, sql } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database } from "../db/database.ts";
import { presetsTable } from "../db/schema.ts";
import { type AccountId, type DeviceId, Preset } from "./preset.ts";

const decodePresets = Schema.decodeUnknownEffect(Schema.Array(Preset));

/**
 * Presets stored per account and device, served back to speakers by the
 * Marge API. A device's presets in one account are invisible to every other.
 */
export class PresetsRepo extends Context.Service<
  PresetsRepo,
  {
    readonly findByDevice: (
      accountId: AccountId,
      deviceId: DeviceId,
    ) => Effect.Effect<readonly Preset[]>;
    /**
     * Inserts or replaces presets by id. `updatedOn` is always the current
     * time; `createdOn` is kept from the stored row, else taken from the
     * preset, else the current time.
     */
    readonly upsert: (
      accountId: AccountId,
      deviceId: DeviceId,
      presets: readonly Preset[],
    ) => Effect.Effect<void>;
  }
>()("@revive-st/api/presets/PresetsRepo") {
  static readonly layerNoDeps = Layer.effect(
    PresetsRepo,
    Effect.gen(function* () {
      const db = yield* Database;

      const findByDevice = Effect.fn("PresetsRepo.findByDevice")(function* (
        accountId: AccountId,
        deviceId: DeviceId,
      ) {
        const rows = yield* db
          .select()
          .from(presetsTable)
          .where(
            and(
              eq(presetsTable.accountId, accountId),
              eq(presetsTable.deviceId, deviceId),
            ),
          )
          .orderBy(asc(presetsTable.presetId));
        return yield* decodePresets(
          rows.map((row) => ({
            id: row.presetId,
            createdOn: row.createdOn ?? undefined,
            updatedOn: row.updatedOn ?? undefined,
            contentItem: {
              source: row.source,
              type: row.contentItemType,
              location: row.location,
              sourceAccount: row.sourceAccount,
              isPresetable: row.isPresetable,
              itemName: row.itemName,
              containerArt: row.containerArt,
            },
          })),
        );
      }, Effect.orDie);

      const upsert = Effect.fn("PresetsRepo.upsert")(function* (
        accountId: AccountId,
        deviceId: DeviceId,
        presets: readonly Preset[],
      ) {
        if (presets.length === 0) {
          return;
        }
        const now = DateTime.toEpochMillis(yield* DateTime.now);
        yield* db
          .insert(presetsTable)
          .values(
            presets.map((preset) => ({
              accountId,
              deviceId,
              presetId: preset.id,
              createdOn: preset.createdOn ?? now,
              updatedOn: now,
              source: preset.contentItem.source,
              contentItemType: preset.contentItem.type,
              location: preset.contentItem.location,
              sourceAccount: preset.contentItem.sourceAccount,
              isPresetable: preset.contentItem.isPresetable,
              itemName: preset.contentItem.itemName,
              containerArt: preset.contentItem.containerArt,
            })),
          )
          .onConflictDoUpdate({
            target: [
              presetsTable.accountId,
              presetsTable.deviceId,
              presetsTable.presetId,
            ],
            set: {
              updatedOn: sql`excluded.updated_on`,
              source: sql`excluded.source`,
              contentItemType: sql`excluded.content_item_type`,
              location: sql`excluded.location`,
              sourceAccount: sql`excluded.source_account`,
              isPresetable: sql`excluded.is_presetable`,
              itemName: sql`excluded.item_name`,
              containerArt: sql`excluded.container_art`,
            },
          });
      }, Effect.orDie);

      return PresetsRepo.of({ findByDevice, upsert });
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(Database.layer));

  static readonly layerTest = this.layerNoDeps.pipe(
    Layer.provide(Database.layerTest),
  );
}
