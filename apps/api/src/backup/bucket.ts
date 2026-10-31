import { AwsClient } from "aws4fetch";
import { parseXml, type XmlNode } from "bose-api-speaker-client";
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

/**
 * The bucket database snapshots are stored in, on any S3-compatible storage
 * (R2 in production), addressed path-style.
 */
export class BackupBucket extends Context.Service<
  BackupBucket,
  {
    readonly put: (
      key: string,
      body: Uint8Array,
    ) => Effect.Effect<void, BucketError>;
    /** When the newest object under `prefix` was stored, in epoch milliseconds. */
    readonly lastStoredAt: (
      prefix: string,
    ) => Effect.Effect<Option.Option<number>, BucketError>;
  }
>()("@revive-st/api/backup/BackupBucket") {
  static readonly s3 = (settings: S3Settings) => {
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
          return body;
        },
        catch: (reason) => new BucketError({ operation, reason }),
      }).pipe(
        Effect.timeoutOrElse({
          duration: "2 minutes",
          orElse: () =>
            Effect.fail(new BucketError({ operation, reason: "timed out" })),
        }),
      );

    const put = Effect.fn("BackupBucket.put")(function* (
      key: string,
      body: Uint8Array,
    ) {
      yield* send("put", `${bucketUrl}/${key}`, { method: "PUT", body });
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
        const xml = yield* send("list", `${bucketUrl}?${query.toString()}`, {
          method: "GET",
        });
        const document = yield* Effect.try({
          try: () => parseXml(xml),
          catch: (reason) => new BucketError({ operation: "list", reason }),
        });
        const result =
          document.name === "ListBucketResult"
            ? document
            : (child(document, "ListBucketResult") ?? document);
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

    return BackupBucket.of({ put, lastStoredAt });
  };
}
