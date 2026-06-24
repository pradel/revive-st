declare const process: {
  env: {
    DATABASE_URL?: string;
    RAILWAY_VOLUME_MOUNT_PATH?: string;
  };
};

import { createClient } from "@libsql/client";

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

const dbUrl =
  process.env.DATABASE_URL ??
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? `file:${process.env.RAILWAY_VOLUME_MOUNT_PATH}/presets.db`
    : "file:presets.db");
const db = createClient({
  url: dbUrl,
});

// Initialize schema
db.execute(`
  CREATE TABLE IF NOT EXISTS presets (
    device_id TEXT NOT NULL,
    preset_id INTEGER NOT NULL,
    created_on INTEGER,
    updated_on INTEGER,
    source TEXT NOT NULL,
    location TEXT NOT NULL,
    source_account TEXT,
    is_presetable BOOLEAN,
    item_name TEXT,
    PRIMARY KEY (device_id, preset_id)
  )
`).catch(() => {
  // Ignored in tests or silent failures
});

export async function getPresets(deviceId: string): Promise<Preset[]> {
  const result = await db.execute({
    sql: "SELECT * FROM presets WHERE device_id = ? ORDER BY preset_id ASC",
    args: [deviceId],
  });

  return result.rows.map((row) => ({
    id: row.preset_id as number,
    createdOn: row.created_on ? (row.created_on as number) : undefined,
    updatedOn: row.updated_on ? (row.updated_on as number) : undefined,
    contentItem: {
      source: row.source as string,
      location: row.location as string,
      sourceAccount: row.source_account as string,
      isPresetable: row.is_presetable === 1,
      itemName: row.item_name as string,
    },
  }));
}

export async function savePresets(
  deviceId: string,
  presets: Preset[],
): Promise<void> {
  const insertStatements = presets.map((preset) => ({
    sql: `
      INSERT INTO presets (device_id, preset_id, created_on, updated_on, source, location, source_account, is_presetable, item_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      deviceId,
      preset.id,
      preset.createdOn ?? null,
      preset.updatedOn ?? null,
      preset.contentItem.source,
      preset.contentItem.location,
      preset.contentItem.sourceAccount,
      preset.contentItem.isPresetable ? 1 : 0,
      preset.contentItem.itemName,
    ],
  }));

  const allStatements = [
    { sql: "DELETE FROM presets WHERE device_id = ?", args: [deviceId] },
    ...insertStatements,
  ];

  await db.batch(allStatements, "write");
}
