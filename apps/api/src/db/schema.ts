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
 * numbers, name) is stored: speakers don't need it back. The time of each
 * speaker's last request is kept apart, in `deviceContactsTable`.
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

/**
 * When each speaker last made a request to this server, keyed by device id
 * (upper-case), so the app can confirm a speaker it configured reached the
 * server. See docs/adr/0001-record-speaker-contacts.md.
 */
export const deviceContactsTable = sqliteTable("device_contacts", {
  deviceId: text("device_id").primaryKey(),
  /** Epoch milliseconds. */
  lastContactAt: integer("last_contact_at").notNull(),
});
