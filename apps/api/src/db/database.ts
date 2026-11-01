import { SqliteClient } from "@effect/sql-sqlite-node";
import { sql } from "drizzle-orm";
import * as SqliteDrizzle from "drizzle-orm/effect-sqlite-node";
import { migrate } from "drizzle-orm/effect-sqlite-node/migrator";
import { Context, Effect, Layer, Schema } from "effect";

import {
  DatabaseBudgetBytes,
  DatabasePath,
  DEFAULT_DATABASE_BUDGET_MB,
  migrationsFolder,
} from "../config.ts";

/**
 * How large the database may grow, in bytes. Past `softBytes` repositories
 * store no new speaker (`hasRoom`), while those stored keep working. At
 * `hardBytes` SQLite itself refuses to grow (`max_page_count`): every write
 * that needs a new page fails.
 */
export class StorageBudget extends Context.Service<
  StorageBudget,
  { readonly softBytes: number; readonly hardBytes: number }
>()("@revive-st/api/db/StorageBudget") {
  /** A budget of `softBytes`, with SQLite's limit half as much again. */
  static readonly ofSoft = (softBytes: number) =>
    StorageBudget.of({ softBytes, hardBytes: softBytes * 1.5 });

  /** `DATABASE_BUDGET_MB`. */
  static readonly layer = Layer.effect(
    StorageBudget,
    Effect.gen(function* () {
      return StorageBudget.ofSoft(yield* DatabaseBudgetBytes);
    }),
  );
}

/**
 * Whether the database is under `softBytes`, as an SQL condition. Free pages
 * don't count: SQLite reuses them before growing the file.
 */
export const hasRoom = (softBytes: number) =>
  sql`(SELECT (page_count - freelist_count) * page_size FROM pragma_page_count(), pragma_freelist_count(), pragma_page_size()) < ${softBytes}`;

const PageSize = Schema.Struct({ page_size: Schema.Int });

/**
 * The Drizzle database on Node's built-in SQLite (`node:sqlite`), migrated
 * with `drizzle/` before first use and capped at the budget's `hardBytes`.
 * `$client` is the underlying SQLite client, for what Drizzle doesn't cover
 * (online backups, pragmas).
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
      const { hardBytes } = yield* StorageBudget;
      const [{ page_size }] = yield* db.$client
        .unsafe("SELECT page_size FROM pragma_page_size()")
        .pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Schema.Tuple([PageSize]))),
        );
      // Per connection, and the client has one. A database already larger
      // keeps its size: SQLite never lowers the limit below it.
      yield* db.$client.unsafe(
        `PRAGMA max_page_count = ${Math.ceil(hardBytes / page_size)}`,
      );
      return db;
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provideMerge(StorageBudget.layer),
    Layer.provide(
      Layer.unwrap(
        Effect.gen(function* () {
          return SqliteClient.layer({ filename: yield* DatabasePath });
        }),
      ),
    ),
  );

  /**
   * A fresh, migrated in-memory database within `budget`, by default the
   * production one.
   */
  static readonly layerTestWith = (
    budget = StorageBudget.ofSoft(DEFAULT_DATABASE_BUDGET_MB * 1024 * 1024),
  ) =>
    this.layerNoDeps.pipe(
      Layer.provideMerge(Layer.succeed(StorageBudget, budget)),
      Layer.provide(SqliteClient.layer({ filename: ":memory:" })),
    );

  /** A fresh, migrated in-memory database. */
  static readonly layerTest = this.layerTestWith();
}
