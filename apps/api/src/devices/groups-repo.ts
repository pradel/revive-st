import { randomInt } from "node:crypto";

import { and, eq, inArray, or } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { Database } from "../db/database.ts";
import { groupsTable } from "../db/schema.ts";
import type { AccountId } from "../marge/account.ts";
import { DeviceId } from "../presets/preset.ts";

/** Seven decimal digits, as Bose's Marge numbered groups. */
export const GroupId = Schema.String.check(Schema.isPattern(/^\d{7}$/)).pipe(
  Schema.brand("GroupId"),
);
export type GroupId = typeof GroupId.Type;

/** A stereo pair's name, bounded like a speaker's preset names. */
export const GroupName = Schema.String.check(Schema.isMaxLength(512));

/** A stereo pair as a speaker creates it. Device ids in either case. */
export interface NewGroup {
  readonly name: string;
  readonly masterDeviceId: DeviceId;
  readonly leftDeviceId: DeviceId;
  readonly rightDeviceId: DeviceId;
}

/** A stored stereo pair. Device ids are upper-case. */
export interface StoredGroup extends NewGroup {
  readonly id: GroupId;
}

const decodeRow = Schema.decodeUnknownEffect(
  Schema.Struct({
    id: GroupId,
    name: Schema.String,
    masterDeviceId: DeviceId,
    leftDeviceId: DeviceId,
    rightDeviceId: DeviceId,
  }),
);

const columns = {
  id: groupsTable.id,
  name: groupsTable.name,
  masterDeviceId: groupsTable.masterDeviceId,
  leftDeviceId: groupsTable.leftDeviceId,
  rightDeviceId: groupsTable.rightDeviceId,
};

const upper = (deviceId: DeviceId) => deviceId.toUpperCase() as DeviceId;

/**
 * The stereo pairs of each account. A speaker is in at most one pair per
 * account: creating a pair replaces those its speakers were in, as the
 * firmware only creates one when both speakers stand alone.
 */
export class GroupsRepo extends Context.Service<
  GroupsRepo,
  {
    /**
     * Stores `group` under a new id, after deleting the account's pairs that
     * contain either of its speakers.
     */
    readonly create: (
      accountId: AccountId,
      group: NewGroup,
    ) => Effect.Effect<StoredGroup>;
    /** The account's pair containing `deviceId`, if any. */
    readonly findByDevice: (
      accountId: AccountId,
      deviceId: DeviceId,
    ) => Effect.Effect<StoredGroup | undefined>;
    /** Renames the account's pair `groupId`; the renamed pair, if any. */
    readonly rename: (
      accountId: AccountId,
      groupId: GroupId,
      name: string,
    ) => Effect.Effect<StoredGroup | undefined>;
    /** Deletes the account's pair `groupId`, if any. */
    readonly remove: (
      accountId: AccountId,
      groupId: GroupId,
    ) => Effect.Effect<void>;
  }
>()("@revive-st/api/devices/GroupsRepo") {
  static readonly layerNoDeps = Layer.effect(
    GroupsRepo,
    Effect.gen(function* () {
      const db = yield* Database;

      const create = Effect.fn("GroupsRepo.create")(function* (
        accountId: AccountId,
        group: NewGroup,
      ) {
        const left = upper(group.leftDeviceId);
        const right = upper(group.rightDeviceId);
        const members = [left, right];
        yield* db
          .delete(groupsTable)
          .where(
            and(
              eq(groupsTable.accountId, accountId),
              or(
                inArray(groupsTable.leftDeviceId, members),
                inArray(groupsTable.rightDeviceId, members),
              ),
            ),
          );
        const createdOn = DateTime.toEpochMillis(yield* DateTime.now);
        // Ids are global; draw again on the rare collision.
        while (true) {
          const id = String(randomInt(1_000_000, 10_000_000)) as GroupId;
          const inserted = yield* db
            .insert(groupsTable)
            .values({
              id,
              accountId,
              name: group.name,
              masterDeviceId: upper(group.masterDeviceId),
              leftDeviceId: left,
              rightDeviceId: right,
              createdOn,
            })
            .onConflictDoNothing()
            .returning({ id: groupsTable.id });
          if (inserted.length > 0) {
            return {
              id,
              name: group.name,
              masterDeviceId: upper(group.masterDeviceId),
              leftDeviceId: left,
              rightDeviceId: right,
            } satisfies StoredGroup;
          }
        }
      }, Effect.orDie);

      const findByDevice = Effect.fn("GroupsRepo.findByDevice")(function* (
        accountId: AccountId,
        deviceId: DeviceId,
      ) {
        const id = upper(deviceId);
        const [row] = yield* db
          .select(columns)
          .from(groupsTable)
          .where(
            and(
              eq(groupsTable.accountId, accountId),
              or(
                eq(groupsTable.leftDeviceId, id),
                eq(groupsTable.rightDeviceId, id),
              ),
            ),
          );
        return row === undefined ? undefined : yield* decodeRow(row);
      }, Effect.orDie);

      const rename = Effect.fn("GroupsRepo.rename")(function* (
        accountId: AccountId,
        groupId: GroupId,
        name: string,
      ) {
        const [row] = yield* db
          .update(groupsTable)
          .set({ name })
          .where(
            and(
              eq(groupsTable.accountId, accountId),
              eq(groupsTable.id, groupId),
            ),
          )
          .returning(columns);
        return row === undefined ? undefined : yield* decodeRow(row);
      }, Effect.orDie);

      const remove = Effect.fn("GroupsRepo.remove")(function* (
        accountId: AccountId,
        groupId: GroupId,
      ) {
        yield* db
          .delete(groupsTable)
          .where(
            and(
              eq(groupsTable.accountId, accountId),
              eq(groupsTable.id, groupId),
            ),
          );
      }, Effect.orDie);

      return GroupsRepo.of({ create, findByDevice, rename, remove });
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(Database.layer));

  static readonly layerTest = this.layerNoDeps.pipe(
    Layer.provide(Database.layerTest),
  );
}
