import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const presetsTable = sqliteTable(
  "presets",
  {
    accountId: text("account_id").notNull(),
    deviceId: text("device_id").notNull(),
    presetId: integer("preset_id").notNull(),
    createdOn: integer("created_on"),
    updatedOn: integer("updated_on"),
    source: text("source").notNull(),
    /** The ContentItem `type`, Marge's `contentItemType`. */
    contentItemType: text("content_item_type").notNull(),
    location: text("location").notNull(),
    sourceAccount: text("source_account").notNull(),
    isPresetable: integer("is_presetable", { mode: "boolean" }).notNull(),
    itemName: text("item_name").notNull(),
    containerArt: text("container_art").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.accountId, table.deviceId, table.presetId],
    }),
  ],
);

/**
 * The speakers paired with each account. A speaker can be listed in several
 * accounts: pairing never removes it from one, as its device id (its MAC
 * address) is no secret. Nothing else about the speaker (IP address, serial
 * numbers, name) is stored: speakers don't need it back.
 */
export const devicesTable = sqliteTable(
  "devices",
  {
    accountId: text("account_id").notNull(),
    deviceId: text("device_id").notNull(),
    /** Epoch milliseconds. */
    pairedOn: integer("paired_on").notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.deviceId] })],
);
