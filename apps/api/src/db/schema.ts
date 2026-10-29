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
