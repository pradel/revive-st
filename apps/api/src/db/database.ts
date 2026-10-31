import { SqliteClient } from "@effect/sql-sqlite-node";
import * as SqliteDrizzle from "drizzle-orm/effect-sqlite-node";
import { migrate } from "drizzle-orm/effect-sqlite-node/migrator";
import { Context, Effect, Layer } from "effect";

import { DatabasePath, migrationsFolder } from "../config.ts";

/**
 * The Drizzle database on Node's built-in SQLite (`node:sqlite`), migrated
 * with `drizzle/` before first use. `$client` is the underlying SQLite client,
 * for what Drizzle doesn't cover (online backups).
 */
export class Database extends Context.Service<
  Database,
  SqliteDrizzle.EffectSQLiteNodeDatabase & {
    readonly $client: SqliteClient.SqliteClient;
  }
>()("@revive-st/api/db/Database") {
  static readonly layerNoDeps = Layer.effect(
    Database,
    Effect.gen(function* () {
      const db = yield* SqliteDrizzle.makeWithDefaults();
      yield* migrate(db, { migrationsFolder });
      return db;
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(
      Layer.unwrap(
        Effect.gen(function* () {
          return SqliteClient.layer({ filename: yield* DatabasePath });
        }),
      ),
    ),
  );

  /** A fresh, migrated in-memory database. */
  static readonly layerTest = this.layerNoDeps.pipe(
    Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
  );
}
