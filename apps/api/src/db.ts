import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import { dbUrl } from "./config.js";
import { presetsTable, type Preset } from "./db/schema.js";

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
