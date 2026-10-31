import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";

import { assert, describe, it } from "@effect/vitest";
import { Clock, Effect, Fiber, Layer, Option, Queue, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { Database } from "../db/database.ts";
import { devicesTable } from "../db/schema.ts";
import { DatabaseBackup, runBackups, SNAPSHOT_PREFIX } from "./backup.ts";
import { BackupBucket, BucketError } from "./bucket.ts";

interface StoredObject {
  key: string;
  body: Uint8Array;
  storedAt: number;
}

/**
 * A bucket in memory. `failPuts` makes the next uploads fail; every upload
 * attempt is offered to `attempts`, so a test can wait for the next one.
 */
const memoryBucket = Effect.gen(function* () {
  const objects: StoredObject[] = [];
  const state = { failPuts: 0 };
  const attempts = yield* Queue.unbounded<"stored" | "failed">();
  const layer = Layer.succeed(
    BackupBucket,
    BackupBucket.of({
      put: (key, body) =>
        Effect.gen(function* () {
          if (state.failPuts > 0) {
            state.failPuts--;
            yield* Queue.offer(attempts, "failed");
            return yield* new BucketError({ operation: "put", reason: "down" });
          }
          objects.push({ key, body, storedAt: yield* Clock.currentTimeMillis });
          yield* Queue.offer(attempts, "stored");
        }),
      lastStoredAt: (prefix) =>
        Effect.succeed(
          Option.fromNullishOr(
            objects
              .filter(({ key }) => key.startsWith(prefix))
              .map(({ storedAt }) => storedAt)
              .toSorted((a, b) => b - a)[0],
          ),
        ),
    }),
  );
  return { objects, state, attempts, layer };
});

type MemoryBucket = Effect.Success<typeof memoryBucket>;

const HEARTBEAT_URL = "https://hc-ping.example/backup";

/** A heartbeat endpoint recording the URLs it is called with. */
const heartbeatServer = (pings: string[]) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      pings.push(url.toString());
      return Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response("OK")),
      );
    }),
  );

const backupWith = (bucket: MemoryBucket, pings: string[] = []) =>
  DatabaseBackup.layerNoDeps(Option.some(Redacted.make(HEARTBEAT_URL))).pipe(
    Layer.provideMerge(Database.layerTest),
    Layer.provide([bucket.layer, heartbeatServer(pings)]),
  );

/** The `device_id`s of `devices` in a gzipped database snapshot. */
const devicesIn = (gzipped: Uint8Array) => {
  const directory = mkdtempSync(join(tmpdir(), "backup-test-"));
  try {
    const path = join(directory, "snapshot.db");
    writeFileSync(path, gunzipSync(gzipped));
    const snapshot = new DatabaseSync(path, { readOnly: true });
    const rows = snapshot.prepare("SELECT device_id FROM devices").all();
    snapshot.close();
    return rows.map((row) => row.device_id);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("DatabaseBackup", () => {
  it.effect("stores a gzipped, readable copy of the database", () =>
    Effect.gen(function* () {
      const bucket = yield* memoryBucket;
      const pings: string[] = [];
      yield* Effect.gen(function* () {
        const db = yield* Database;
        yield* db
          .insert(devicesTable)
          .values({ accountId: "a", deviceId: "AABBCCDDEEFF", pairedOn: 1 });
        yield* TestClock.adjust("3 hours");

        const { key } = yield* (yield* DatabaseBackup).snapshot;

        assert.strictEqual(key, `${SNAPSHOT_PREFIX}1970-01-01T03-00-00Z.db.gz`);
        assert.deepStrictEqual(devicesIn(bucket.objects[0].body), [
          "AABBCCDDEEFF",
        ]);
        assert.deepStrictEqual(pings, [HEARTBEAT_URL]);
      }).pipe(Effect.provide(backupWith(bucket, pings)));
    }),
  );

  it.effect("does not report a snapshot it failed to store", () =>
    Effect.gen(function* () {
      const bucket = yield* memoryBucket;
      bucket.state.failPuts = 1;
      const pings: string[] = [];
      const error = yield* Effect.flip(
        Effect.flatMap(DatabaseBackup, (backup) => backup.snapshot),
      ).pipe(Effect.provide(backupWith(bucket, pings)));
      assert.strictEqual(error._tag, "BucketError");
      assert.deepStrictEqual(pings, []);
    }),
  );

  it.effect("catches up only when the newest snapshot is a day old", () =>
    Effect.gen(function* () {
      const bucket = yield* memoryBucket;
      yield* Effect.gen(function* () {
        const backup = yield* DatabaseBackup;
        // No snapshot yet.
        assert.isTrue(yield* backup.snapshotIfDue);
        yield* TestClock.adjust("23 hours");
        assert.isFalse(yield* backup.snapshotIfDue);
        yield* TestClock.adjust("1 hour");
        assert.isTrue(yield* backup.snapshotIfDue);
        assert.strictEqual(bucket.objects.length, 2);
      }).pipe(Effect.provide(backupWith(bucket)));
    }),
  );
});

describe("runBackups", () => {
  it.effect(
    "stores a snapshot every day at 03:00 UTC, through failed days",
    () =>
      Effect.gen(function* () {
        const bucket = yield* memoryBucket;
        yield* Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(runBackups);
          // At boot (00:00 UTC) there is no snapshot: one is taken right away.
          assert.strictEqual(yield* Queue.take(bucket.attempts), "stored");

          bucket.state.failPuts = 1;
          yield* TestClock.adjust("3 hours");
          assert.strictEqual(yield* Queue.take(bucket.attempts), "failed");

          yield* TestClock.adjust("1 day");
          assert.strictEqual(yield* Queue.take(bucket.attempts), "stored");
          assert.deepStrictEqual(
            bucket.objects.map(({ key }) => key),
            [
              `${SNAPSHOT_PREFIX}1970-01-01T00-00-00Z.db.gz`,
              `${SNAPSHOT_PREFIX}1970-01-02T03-00-00Z.db.gz`,
            ],
          );
          yield* Fiber.interrupt(fiber);
        }).pipe(Effect.provide(backupWith(bucket)));
      }),
  );
});
