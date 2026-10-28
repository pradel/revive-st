import { fileURLToPath } from "node:url";

import { LibsqlClient } from "@effect/sql-libsql";
import * as LibsqlDrizzle from "drizzle-orm/effect-libsql";
import { migrate } from "drizzle-orm/effect-libsql/migrator";
import { Context, Effect, Layer } from "effect";

import { DatabaseUrl } from "../config.ts";

const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

/** The Drizzle database, migrated with `drizzle/` before first use. */
export class Database extends Context.Service<
  Database,
  LibsqlDrizzle.EffectLibsqlDatabase
>()("@revive-st/api/db/Database") {
  static readonly layerNoDeps = Layer.effect(
    Database,
    Effect.gen(function* () {
      const db = yield* LibsqlDrizzle.makeWithDefaults();
      yield* migrate(db, { migrationsFolder });
      return db;
    }),
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(
      Layer.unwrap(
        Effect.gen(function* () {
          return LibsqlClient.layer({ url: yield* DatabaseUrl });
        }),
      ),
    ),
  );

  /** A fresh, migrated in-memory database. */
  static readonly layerTest = this.layerNoDeps.pipe(
    Layer.provide(LibsqlClient.layer({ url: ":memory:" })),
  );
}
