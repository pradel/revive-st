import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const presetsTable = sqliteTable(
  "presets",
  {
    deviceId: text("device_id").notNull(),
    presetId: integer("preset_id").notNull(),
    createdOn: integer("created_on"),
    updatedOn: integer("updated_on"),
    source: text("source").notNull(),
    location: text("location").notNull(),
    sourceAccount: text("source_account").notNull(),
    isPresetable: integer("is_presetable", { mode: "boolean" }).notNull(),
    itemName: text("item_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.deviceId, table.presetId] })],
);
