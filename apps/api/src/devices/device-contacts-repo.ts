import { eq, sql } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database, hasRoom, StorageBudget } from "../db/database.ts";
import { deviceContactsTable } from "../db/schema.ts";
import { type DeviceId, SpeakerDeviceId } from "../presets/preset.ts";

const isSpeakerDeviceId = Schema.is(SpeakerDeviceId);

/**
 * When each speaker last made a request to this server, so the app can
 * confirm a speaker it configured reached it. Device ids are MAC addresses,
 * so they are stored upper-case: `ec1127c25a50` names `EC1127C25A50`. See
 * docs/adr/0001-record-speaker-contacts.md.
 */
export class DeviceContactsRepo extends Context.Service<
  DeviceContactsRepo,
  {
    /**
     * Records that `deviceId` contacted the server now; an id that isn't a
     * MAC address is not stored, nor a new speaker once the database is past
     * its `StorageBudget`. Never fails: a speaker request must not fail for
     * want of recording it, so errors are logged.
     */
    readonly record: (deviceId: DeviceId) => Effect.Effect<void>;
    /** When `deviceId` last contacted the server, in epoch milliseconds. */
    readonly lastContactAt: (
      deviceId: DeviceId,
    ) => Effect.Effect<number | undefined>;
  }
>()("@revive-st/api/devices/DeviceContactsRepo") {
  static readonly layerNoDeps = Layer.effect(
    DeviceContactsRepo,
    Effect.gen(function* () {
      const db = yield* Database;
      const { softBytes } = yield* StorageBudget;

      const record = Effect.fn("DeviceContactsRepo.record")(
        function* (deviceId: DeviceId) {
          if (!isSpeakerDeviceId(deviceId)) {
            return;
          }
          const id = deviceId.toUpperCase();
          const now = DateTime.toEpochMillis(yield* DateTime.now);
          yield* db.run(sql`
            INSERT INTO device_contacts (device_id, last_contact_at)
            SELECT ${id}, ${now}
            WHERE ${hasRoom(softBytes)}
              OR EXISTS (SELECT 1 FROM device_contacts WHERE device_id = ${id})
            ON CONFLICT (device_id) DO UPDATE
              SET last_contact_at = excluded.last_contact_at
          `);
        },
        Effect.ignoreCause({
          log: "Warn",
          message: "Could not record a speaker's contact",
        }),
      );

      const lastContactAt = Effect.fn("DeviceContactsRepo.lastContactAt")(
        function* (deviceId: DeviceId) {
          const [row] = yield* db
            .select({ lastContactAt: deviceContactsTable.lastContactAt })
            .from(deviceContactsTable)
            .where(eq(deviceContactsTable.deviceId, deviceId.toUpperCase()));
          return row?.lastContactAt;
        },
        Effect.orDie,
      );

      return DeviceContactsRepo.of({ record, lastContactAt });
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(Database.layer));

  static readonly layerTest = this.layerNoDeps.pipe(
    Layer.provide(Database.layerTest),
  );
}
