import { fileURLToPath } from "node:url";

import { Config } from "effect";

/**
 * libSQL URL of the presets database: `DATABASE_URL`, else a file on the
 * Railway volume, else `revivest.db` in the working directory.
 */
export const DatabaseUrl = Config.String("DATABASE_URL").pipe(
  Config.orElse(() =>
    Config.String("RAILWAY_VOLUME_MOUNT_PATH").pipe(
      Config.map((directory) => `file:${directory}/revivest.db`),
    ),
  ),
  Config.withDefault("file:revivest.db"),
);

export const ServerPort = Config.Port("PORT").pipe(Config.withDefault(3000));

/**
 * The Drizzle migrations, `drizzle/` next to `src/`. Resolved from a module
 * directly under `src/` so the path also holds in the `dist/` bundle.
 */
export const migrationsFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);
