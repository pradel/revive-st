import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";

import { BackupBucket } from "./bucket.ts";

const PART_BYTES = 1024;

const bodyOf = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
};

/**
 * Just enough of S3's multipart upload: parts are kept by number, and the
 * object is the parts the completion lists, in its order.
 */
const fakeS3 = (options: { failPart?: number; completeError?: boolean }) =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const parts = new Map<number, Buffer>();
      const objects = new Map<string, Buffer>();
      const aborted: string[] = [];
      const server = createServer((request, response) => {
        void (async () => {
          const url = new URL(request.url ?? "", "http://localhost");
          const body = await bodyOf(request);
          const uploadId = url.searchParams.get("uploadId");
          if (request.method === "POST" && url.searchParams.has("uploads")) {
            response.end(
              '<?xml version="1.0" encoding="UTF-8"?><InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>',
            );
          } else if (request.method === "PUT" && uploadId === "upload-1") {
            const number = Number(url.searchParams.get("partNumber"));
            if (number === options.failPart) {
              // A 4xx: the client retries 5xx answers for a minute.
              response.statusCode = 403;
              response.end("<Error><Code>AccessDenied</Code></Error>");
              return;
            }
            parts.set(number, body);
            response.setHeader("ETag", `"etag-${number}"`);
            response.end();
          } else if (request.method === "POST" && uploadId === "upload-1") {
            if (options.completeError === true) {
              response.end(
                "<Error><Code>InvalidPart</Code><Message>One or more of the specified parts could not be found.</Message></Error>",
              );
              return;
            }
            const listed = [
              ...body
                .toString()
                .matchAll(
                  /<PartNumber>(\d+)<\/PartNumber><ETag>&quot;etag-\1&quot;<\/ETag>/g,
                ),
            ].map(([, number]) => Number(number));
            objects.set(
              url.pathname,
              Buffer.concat(
                listed.map((number) => parts.get(number) ?? Buffer.alloc(0)),
              ),
            );
            response.end(
              "<CompleteMultipartUploadResult><ETag>&quot;object&quot;</ETag></CompleteMultipartUploadResult>",
            );
          } else if (request.method === "DELETE" && uploadId !== null) {
            aborted.push(uploadId);
            response.statusCode = 204;
            response.end();
          } else {
            response.statusCode = 400;
            response.end();
          }
        })();
      });
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
      });
      const bucket = BackupBucket.s3(
        {
          endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
          region: "auto",
          accessKeyId: Redacted.make("key"),
          secretAccessKey: Redacted.make("secret"),
          bucket: "backups",
        },
        PART_BYTES,
      );
      return { server, bucket, parts, objects, aborted };
    }),
    ({ server }) =>
      Effect.promise(
        async () =>
          new Promise<void>((resolve) => {
            server.close(() => {
              resolve();
            });
          }),
      ),
  );

/** A file of `size` random bytes, removed with the scope. */
const randomFile = (size: number) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const directory = mkdtempSync(join(tmpdir(), "bucket-test-"));
      const path = join(directory, "snapshot.db.gz");
      const content = randomBytes(size);
      writeFileSync(path, content);
      return { directory, path, content };
    }),
    ({ directory }) =>
      Effect.sync(() => {
        rmSync(directory, { recursive: true, force: true });
      }),
  );

describe("BackupBucket.s3 upload", () => {
  it.effect.each([0, 1000, 2 * PART_BYTES, 2.5 * PART_BYTES])(
    "stores a file of %d bytes whole, one part per PART_BYTES",
    (size) =>
      Effect.gen(function* () {
        const s3 = yield* fakeS3({});
        const file = yield* randomFile(size);

        yield* s3.bucket.upload("db/snapshot.db.gz", file.path);

        assert.deepStrictEqual(
          s3.objects.get("/backups/db/snapshot.db.gz"),
          file.content,
        );
        assert.strictEqual(
          s3.parts.size,
          Math.max(1, Math.ceil(size / PART_BYTES)),
        );
      }).pipe(Effect.scoped),
  );

  it.effect("aborts the upload when a part fails", () =>
    Effect.gen(function* () {
      const s3 = yield* fakeS3({ failPart: 2 });
      const file = yield* randomFile(3 * PART_BYTES);

      const error = yield* Effect.flip(
        s3.bucket.upload("db/snapshot.db.gz", file.path),
      );

      assert.strictEqual(error._tag, "BucketError");
      assert.deepStrictEqual(s3.aborted, ["upload-1"]);
      assert.strictEqual(s3.objects.size, 0);
    }).pipe(Effect.scoped),
  );

  it.effect("fails and aborts when the completion answers an error", () =>
    Effect.gen(function* () {
      const s3 = yield* fakeS3({ completeError: true });
      const file = yield* randomFile(PART_BYTES);

      const error = yield* Effect.flip(
        s3.bucket.upload("db/snapshot.db.gz", file.path),
      );

      assert.strictEqual(error._tag, "BucketError");
      assert.deepStrictEqual(s3.aborted, ["upload-1"]);
    }).pipe(Effect.scoped),
  );
});
