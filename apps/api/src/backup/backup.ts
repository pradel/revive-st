import { createReadStream, createWriteStream, rmSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import {
  Clock,
  Context,
  Cron,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Schema,
} from "effect";

import { BackupConfig } from "../config.ts";
import { Database } from "../db/database.ts";
import { BackupBucket, type BucketError } from "./bucket.ts";

/** Snapshots are stored under this prefix, one object per snapshot. */
export const SNAPSHOT_PREFIX = "db/";

/** Every day at 03:00 UTC, when speakers are least busy in Europe. */
export const SNAPSHOT_SCHEDULE = Cron.parseUnsafe("0 3 * * *", "UTC");

/**
 * At boot, a snapshot is taken right away when the newest one is older than
 * this, or missing: a restart or deploy at 03:00 must not cost a day.
 */
export const SNAPSHOT_MAX_AGE = Duration.hours(24);

/** Taking or storing a snapshot failed. */
export class BackupError extends Schema.TaggedError<BackupError>()(
  "BackupError",
  { reason: Schema.Unknown },
) {}

/** `db/2026-10-31T03-00-00Z.db.gz` for a snapshot taken at 03:00 UTC. */
const snapshotKey = (now: DateTime.Utc) =>
  `${SNAPSHOT_PREFIX}${DateTime.formatIso(now)
    .replace(/\.\d+Z$/, "Z")
    .replaceAll(":", "-")}.db.gz`;

/** Daily, gzipped copies of the database, stored in the backup bucket. */
export class DatabaseBackup extends Context.Service<
  DatabaseBackup,
  {
    /** Stores a snapshot of the database now; its key and compressed size. */
    readonly snapshot: Effect.Effect<
      { readonly key: string; readonly bytes: number },
      BackupError | BucketError
    >;
    /** Stores a snapshot unless one younger than `SNAPSHOT_MAX_AGE` exists. */
    readonly snapshotIfDue: Effect.Effect<boolean, BackupError | BucketError>;
  }
>()("@revive-st/api/backup/DatabaseBackup") {
  static readonly layerNoDeps = Layer.effect(
    DatabaseBackup,
    Effect.gen(function* () {
      const db = yield* Database;
      const bucket = yield* BackupBucket;

      /**
       * Copies the database, gzips the copy and uploads it, all through
       * files in the temporary directory: memory stays flat whatever the
       * database's size, and the disk holds about twice it meanwhile.
       */
      const snapshot = Effect.gen(function* () {
        const startedAt = yield* Clock.currentTimeMillis;
        const key = snapshotKey(yield* DateTime.now);
        const directory = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: async () => mkdtemp(join(tmpdir(), "revivest-")),
            catch: (reason) => new BackupError({ reason }),
          }),
          (path) =>
            Effect.sync(() => {
              rmSync(path, { recursive: true, force: true });
            }),
        );
        const copy = join(directory, "snapshot.db");
        const gzipped = `${copy}.gz`;
        // An online backup: a consistent copy while requests keep writing.
        yield* db.$client
          .backup(copy)
          .pipe(Effect.mapError((reason) => new BackupError({ reason })));
        const bytes = yield* Effect.tryPromise({
          try: async () => {
            await pipeline(
              createReadStream(copy),
              createGzip(),
              createWriteStream(gzipped),
            );
            await rm(copy);
            return (await stat(gzipped)).size;
          },
          catch: (reason) => new BackupError({ reason }),
        });
        yield* bucket.upload(key, gzipped);
        yield* Effect.logInfo("Database snapshot stored", {
          key,
          bytes,
          ms: (yield* Clock.currentTimeMillis) - startedAt,
        });
        return { key, bytes } as const;
      }).pipe(Effect.scoped, Effect.withSpan("DatabaseBackup.snapshot"));

      const snapshotIfDue = Effect.gen(function* () {
        const last = yield* bucket.lastStoredAt(SNAPSHOT_PREFIX);
        const now = yield* Clock.currentTimeMillis;
        const due = Option.match(last, {
          onNone: () => true,
          onSome: (storedAt) =>
            now - storedAt >= Duration.toMillis(SNAPSHOT_MAX_AGE),
        });
        if (due) {
          yield* snapshot;
        }
        return due;
      }).pipe(Effect.withSpan("DatabaseBackup.snapshotIfDue"));

      return DatabaseBackup.of({ snapshot, snapshotIfDue });
    }),
  );
}

/**
 * Catches up at boot, then stores a snapshot on `SNAPSHOT_SCHEDULE` for as
 * long as the server runs. A failed run is logged (`Database snapshot
 * failed`) and the schedule goes on.
 */
export const runBackups = Effect.gen(function* () {
  const backup = yield* DatabaseBackup;
  const logFailure = Effect.catchCause((cause) =>
    Effect.logError("Database snapshot failed", cause),
  );
  yield* backup.snapshotIfDue.pipe(logFailure);
  for (;;) {
    const now = yield* Clock.currentTimeMillis;
    const next = Cron.next(SNAPSHOT_SCHEDULE, now).getTime();
    yield* Effect.sleep(Duration.millis(next - now));
    yield* backup.snapshot.pipe(logFailure);
  }
});

/**
 * Runs `runBackups` in the background when `S3_BUCKET` is set; otherwise
 * logs that backups are off.
 */
export const BackupLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* BackupConfig;
    if (Option.isNone(config)) {
      yield* Effect.logInfo("Database backups off: S3_BUCKET is not set");
      return;
    }
    yield* Effect.forkScoped(
      runBackups.pipe(
        Effect.provide(
          DatabaseBackup.layerNoDeps.pipe(
            Layer.provide(
              Layer.succeed(BackupBucket, BackupBucket.s3(config.value)),
            ),
          ),
        ),
      ),
    );
  }),
);
