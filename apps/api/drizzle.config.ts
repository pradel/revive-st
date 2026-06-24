import { defineConfig } from "drizzle-kit";

import { dbUrl } from "./src/config.js";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbUrl,
  },
});
