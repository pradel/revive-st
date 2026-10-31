import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

import {
  Clock,
  Context,
  Cron,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

import { BackupConfig } from "../config.ts";
import { Database } from "../db/database.ts";
import { BackupBucket, type BucketError } from "./bucket.ts";

const gzipAsync = promisify(gzip);

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
  /**
   * `heartbeatUrl` is requested after each stored snapshot, so a monitor
   * alerts when one goes missing; a failed request is only logged.
   */
  static readonly layerNoDeps = (
    heartbeatUrl: Option.Option<Redacted.Redacted>,
  ) =>
    Layer.effect(
      DatabaseBackup,
      Effect.gen(function* () {
        const db = yield* Database;
        const bucket = yield* BackupBucket;
        const http = yield* HttpClient.HttpClient;

        const ping = Option.match(heartbeatUrl, {
          onNone: () => Effect.void,
          onSome: (url) =>
            http.get(Redacted.value(url)).pipe(
              Effect.timeout("10 seconds"),
              Effect.tapError((error) =>
                Effect.logWarning("Backup heartbeat failed", error),
              ),
              Effect.ignore,
            ),
        });

        const snapshot = Effect.gen(function* () {
          const startedAt = yield* Clock.currentTimeMillis;
          const key = snapshotKey(yield* DateTime.now);
          const path = join(tmpdir(), `revivest-${randomUUID()}.db`);
          const body = yield* Effect.gen(function* () {
            // An online backup: a consistent copy while requests keep writing.
            yield* db.$client
              .backup(path)
              .pipe(Effect.mapError((reason) => new BackupError({ reason })));
            return yield* Effect.tryPromise({
              try: async () => gzipAsync(await readFile(path)),
              catch: (reason) => new BackupError({ reason }),
            });
          }).pipe(
            Effect.ensuring(
              Effect.promise(async () => rm(path, { force: true })),
            ),
          );
          yield* bucket.put(key, body);
          yield* Effect.logInfo("Database snapshot stored", {
            key,
            bytes: body.byteLength,
            ms: (yield* Clock.currentTimeMillis) - startedAt,
          });
          yield* ping;
          return { key, bytes: body.byteLength } as const;
        }).pipe(Effect.withSpan("DatabaseBackup.snapshot"));

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
 * long as the server runs. A failed run is logged and the schedule goes on:
 * the heartbeat monitor reports the missing snapshot.
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
    const { heartbeatUrl, ...bucket } = config.value;
    yield* Effect.forkScoped(
      runBackups.pipe(
        Effect.provide(
          DatabaseBackup.layerNoDeps(heartbeatUrl).pipe(
            Layer.provide([
              Layer.succeed(BackupBucket, BackupBucket.s3(bucket)),
              FetchHttpClient.layer,
            ]),
          ),
        ),
      ),
    );
  }),
);
