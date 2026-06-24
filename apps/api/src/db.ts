declare const process: {
  env: {
    DATABASE_URL?: string;
    RAILWAY_VOLUME_MOUNT_PATH?: string;
  };
};

import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export interface ContentItem {
  source: string;
  location: string;
  sourceAccount: string;
  isPresetable: boolean;
  itemName: string;
}

export interface Preset {
  id: number;
  createdOn?: number;
  updatedOn?: number;
  contentItem: ContentItem;
}

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

const dbUrl =
  process.env.DATABASE_URL ??
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? `file:${process.env.RAILWAY_VOLUME_MOUNT_PATH}/presets.db`
    : "file:presets.db");
const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client);

export async function getPresets(deviceId: string): Promise<Preset[]> {
  const result = await db
    .select()
    .from(presetsTable)
    .where(eq(presetsTable.deviceId, deviceId));

  return result.map((row) => ({
    id: row.presetId,
    createdOn: row.createdOn ?? undefined,
    updatedOn: row.updatedOn ?? undefined,
    contentItem: {
      source: row.source,
      location: row.location,
      sourceAccount: row.sourceAccount,
      isPresetable: row.isPresetable,
      itemName: row.itemName,
    },
  }));
}

export async function savePresets(
  deviceId: string,
  presets: Preset[],
): Promise<void> {
  if (!presets || presets.length === 0) {
    return;
  }

  const now = Date.now();

  const valuesToInsert = presets.map((preset) => ({
    deviceId,
    presetId: preset.id,
    createdOn: preset.createdOn ?? now,
    updatedOn: now,
    source: preset.contentItem.source,
    location: preset.contentItem.location,
    sourceAccount: preset.contentItem.sourceAccount,
    isPresetable: preset.contentItem.isPresetable,
    itemName: preset.contentItem.itemName,
  }));

  await db
    .insert(presetsTable)
    .values(valuesToInsert)
    .onConflictDoUpdate({
      target: [presetsTable.deviceId, presetsTable.presetId],
      set: {
        updatedOn: sql`excluded.updated_on`,
        source: sql`excluded.source`,
        location: sql`excluded.location`,
        sourceAccount: sql`excluded.source_account`,
        isPresetable: sql`excluded.is_presetable`,
        itemName: sql`excluded.item_name`,
      },
    });
}
