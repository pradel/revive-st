import { fileURLToPath } from "node:url";

import { Config, Option } from "effect";

/**
 * The SQLite file of the presets database: `DATABASE_PATH`, else a file on the
 * Railway volume, else `revivest.db` in the working directory.
 */
export const DatabasePath = Config.String("DATABASE_PATH").pipe(
  Config.orElse(() =>
    Config.String("RAILWAY_VOLUME_MOUNT_PATH").pipe(
      Config.map((directory) => `${directory}/revivest.db`),
    ),
  ),
  Config.withDefault("revivest.db"),
);

export const ServerPort = Config.Port("PORT").pipe(Config.withDefault(3000));

const LOG_LEVELS = {
  debug: "Debug",
  info: "Info",
  warn: "Warn",
  error: "Error",
} as const;

/** The least severe level logged: `LOG_LEVEL`, else `info`. */
export const MinimumLogLevel = Config.Literals(
  ["debug", "info", "warn", "error"],
  "LOG_LEVEL",
).pipe(
  Config.withDefault("info"),
  Config.map((level) => LOG_LEVELS[level]),
);

/**
 * `LOG_FORMAT`: `json` for one JSON object per line, `pretty` for Effect's
 * readable format. Defaults to `json` on Railway, whose log explorer parses
 * it, and `pretty` elsewhere.
 */
export const LogFormat = Config.all({
  format: Config.option(Config.Literals(["json", "pretty"], "LOG_FORMAT")),
  onRailway: Config.option(Config.String("RAILWAY_ENVIRONMENT_ID")),
}).pipe(
  Config.map(({ format, onRailway }) =>
    Option.getOrElse(format, () =>
      Option.isSome(onRailway) ? "json" : "pretty",
    ),
  ),
);

/**
 * The Drizzle migrations, `drizzle/` next to `src/`. Resolved from a module
 * directly under `src/` so the path also holds in the `dist/` bundle.
 */
export const migrationsFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);
