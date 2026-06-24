import process from "node:process";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      (process.env.RAILWAY_VOLUME_MOUNT_PATH
        ? `file:${process.env.RAILWAY_VOLUME_MOUNT_PATH}/presets.db`
        : "file:presets.db"),
  },
});
