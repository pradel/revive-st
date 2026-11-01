import { Buffer } from "node:buffer";
import { type FileHandle, open } from "node:fs/promises";

import { AwsClient } from "aws4fetch";
import { escapeXml, parseXml, type XmlNode } from "bose-api-speaker-client";
import { Context, Effect, Option, Redacted, Schema } from "effect";

/** The storage could not be reached, refused the request, or answered unreadably. */
export class BucketError extends Schema.TaggedError<BucketError>()(
  "BucketError",
  { operation: Schema.String, reason: Schema.Unknown },
) {}

export interface S3Settings {
  /** The S3 API origin, e.g. `https://<account id>.r2.cloudflarestorage.com`. */
  readonly endpoint: string;
  /** The signing region: `auto` for R2, the bucket's region on AWS. */
  readonly region: string;
  readonly accessKeyId: Redacted.Redacted;
  readonly secretAccessKey: Redacted.Redacted;
  readonly bucket: string;
}

const child = (node: XmlNode, name: string) =>
  node.children.find((item) => item.name === name);

/** `name`, whether it is the document's root or the root's child. */
const resultIn = (document: XmlNode, name: string) =>
  document.name === name ? document : child(document, name);

const parse = (operation: string, xml: string) =>
  Effect.try({
    try: () => parseXml(xml),
    catch: (reason) => new BucketError({ operation, reason }),
  });

/**
 * The size of each uploaded part but the last. S3 wants at least 5 MiB and
 * at most 10,000 parts: 8 MiB parts hold objects up to 80 GB. Signing and
 * sending copy each part a few times, so an upload's memory grows with the
 * part size (about 70 MB here), not the object's.
 */
export const PART_BYTES = 8 * 1024 * 1024;

/**
 * Fills `buffer` from `file` at `position`; how many bytes it holds, fewer
 * only at the end of the file.
 */
const readPart = async (file: FileHandle, buffer: Buffer, position: number) => {
  let filled = 0;
  while (filled < buffer.length) {
    // Each read waits for the previous one: they fill the buffer in turn.
    // oxlint-disable-next-line no-await-in-loop
    const { bytesRead } = await file.read(
      buffer,
      filled,
      buffer.length - filled,
      position + filled,
    );
    if (bytesRead === 0) {
      break;
    }
    filled += bytesRead;
  }
  return filled;
};

/**
 * The bucket database snapshots are stored in, on any S3-compatible storage
 * (R2 in production), addressed path-style.
 */
export class BackupBucket extends Context.Service<
  BackupBucket,
  {
    /** Stores the file at `path` as `key`, without reading it whole. */
    readonly upload: (
      key: string,
      path: string,
    ) => Effect.Effect<void, BucketError>;
    /** When the newest object under `prefix` was stored, in epoch milliseconds. */
    readonly lastStoredAt: (
      prefix: string,
    ) => Effect.Effect<Option.Option<number>, BucketError>;
  }
>()("@revive-st/api/backup/BackupBucket") {
  static readonly s3 = (settings: S3Settings, partBytes = PART_BYTES) => {
    const client = new AwsClient({
      accessKeyId: Redacted.value(settings.accessKeyId),
      secretAccessKey: Redacted.value(settings.secretAccessKey),
      service: "s3",
      region: settings.region,
    });
    const bucketUrl = `${settings.endpoint}/${encodeURIComponent(settings.bucket)}`;

    const send = (operation: string, url: string, init: RequestInit) =>
      Effect.tryPromise({
        try: async (signal) => {
          const response = await client.fetch(url, { ...init, signal });
          const body = await response.text();
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
          }
          return { body, headers: response.headers };
        },
        catch: (reason) => new BucketError({ operation, reason }),
      }).pipe(
        Effect.timeoutOrElse({
          duration: "2 minutes",
          orElse: () =>
            Effect.fail(new BucketError({ operation, reason: "timed out" })),
        }),
      );

    const fail = (reason: unknown) =>
      Effect.fail(new BucketError({ operation: "upload", reason }));

    /** Sends the file at `path` as the parts of `uploadId`, in order. */
    const sendParts = (objectUrl: string, uploadId: string, path: string) =>
      Effect.acquireUseRelease(
        Effect.tryPromise({
          try: async () => open(path),
          catch: (reason) => new BucketError({ operation: "upload", reason }),
        }),
        (file) =>
          Effect.gen(function* () {
            // One buffer for every part: each is sent before the next is read.
            const buffer = Buffer.alloc(partBytes);
            const etags: string[] = [];
            for (;;) {
              // Every part but the last is full.
              const position = etags.length * partBytes;
              const length = yield* Effect.tryPromise({
                try: async () => readPart(file, buffer, position),
                catch: (reason) =>
                  new BucketError({ operation: "upload", reason }),
              });
              // Every upload has a part, even an empty one.
              if (length === 0 && etags.length > 0) {
                return etags;
              }
              const query = new URLSearchParams({
                partNumber: String(etags.length + 1),
                uploadId,
              });
              const { headers } = yield* send(
                "upload",
                `${objectUrl}?${query.toString()}`,
                { method: "PUT", body: buffer.subarray(0, length) },
              );
              const etag = headers.get("etag");
              if (etag === null) {
                return yield* fail(`no ETag for part ${etags.length + 1}`);
              }
              etags.push(etag);
              if (length < partBytes) {
                return etags;
              }
            }
          }),
        (file) => Effect.promise(async () => file.close()),
      );

    /**
     * A multipart upload, one part in memory at a time. A failed upload is
     * aborted, so the storage drops the parts it already has.
     */
    const upload = Effect.fn("BackupBucket.upload")(function* (
      key: string,
      path: string,
    ) {
      const objectUrl = `${bucketUrl}/${key}`;
      const created = yield* send("upload", `${objectUrl}?uploads`, {
        method: "POST",
      });
      const initiated = yield* parse("upload", created.body);
      const uploadId = child(
        resultIn(initiated, "InitiateMultipartUploadResult") ?? initiated,
        "UploadId",
      )?.text;
      if (uploadId === undefined || uploadId === "") {
        return yield* fail(`no UploadId in ${created.body.slice(0, 500)}`);
      }
      const uploadQuery = new URLSearchParams({ uploadId }).toString();
      yield* Effect.gen(function* () {
        const etags = yield* sendParts(objectUrl, uploadId, path);
        const parts = etags
          .map(
            (etag, index) =>
              `<Part><PartNumber>${index + 1}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`,
          )
          .join("");
        const completed = yield* send("upload", `${objectUrl}?${uploadQuery}`, {
          method: "POST",
          body: `<CompleteMultipartUpload>${parts}</CompleteMultipartUpload>`,
        });
        // S3 can answer 200 and still fail the upload in the body.
        const result = yield* parse("upload", completed.body);
        if (resultIn(result, "Error") !== undefined) {
          return yield* fail(completed.body.slice(0, 500));
        }
      }).pipe(
        Effect.onError(() =>
          send("abort", `${objectUrl}?${uploadQuery}`, {
            method: "DELETE",
          }).pipe(Effect.ignore),
        ),
      );
    });

    const lastStoredAt = Effect.fn("BackupBucket.lastStoredAt")(function* (
      prefix: string,
    ) {
      let newest = Option.none<number>();
      let continuation: string | undefined;
      do {
        const query = new URLSearchParams({ "list-type": "2", prefix });
        if (continuation !== undefined) {
          query.set("continuation-token", continuation);
        }
        const { body } = yield* send(
          "list",
          `${bucketUrl}?${query.toString()}`,
          { method: "GET" },
        );
        const document = yield* parse("list", body);
        const result = resultIn(document, "ListBucketResult") ?? document;
        for (const item of result.children.filter(
          (node) => node.name === "Contents",
        )) {
          const storedAt = Date.parse(child(item, "LastModified")?.text ?? "");
          if (
            !Number.isNaN(storedAt) &&
            Option.getOrElse(newest, () => -1) < storedAt
          ) {
            newest = Option.some(storedAt);
          }
        }
        continuation =
          child(result, "IsTruncated")?.text === "true"
            ? child(result, "NextContinuationToken")?.text
            : undefined;
      } while (continuation !== undefined);
      return newest;
    });

    return BackupBucket.of({ upload, lastStoredAt });
  };
}
