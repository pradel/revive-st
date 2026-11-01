import { type Duration, Effect, Layer, Schema } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiMiddleware } from "effect/http-api";
import { RateLimiter } from "effect/persistence";

import { RateLimitEnabled } from "./config.ts";

/** The client made more requests than its limit allows; nothing was done. */
export class TooManyRequests extends Schema.Error<TooManyRequests>(
  "@revive-st/api/TooManyRequests",
)(
  { _tag: Schema.tag("TooManyRequests") },
  { description: "TooManyRequests", httpApiStatus: 429 },
) {}

/**
 * The client a request counts against: the `X-Real-IP` Railway's edge sets,
 * else the connection's address.
 */
const clientOf = (request: HttpServerRequest.HttpServerRequest) =>
  request.headers["x-real-ip"] ??
  (request.remoteAddress._tag === "Some"
    ? request.remoteAddress.value
    : "unknown");

interface Limit {
  /** Keys this limit's counters apart from the others'. */
  readonly name: string;
  /** Requests a client may burst, refilled evenly over `window`. */
  readonly limit: number;
  readonly window: Duration.Input;
}

/**
 * Speakers storing what a button press or rename changes: `savePreset`,
 * `removePreset`, `registerDevice`, `updateDevice`.
 */
export const SPEAKER_WRITES: Limit = {
  name: "speaker-writes",
  limit: 60,
  window: "1 minute",
};

/**
 * The app's preset sync. The app syncs whenever a speaker's state changes,
 * volume included, so a household adjusting volume syncs in bursts.
 */
export const PRESET_SYNCS: Limit = {
  name: "preset-syncs",
  limit: 300,
  window: "1 minute",
};

/** Minting an account, which the app does once per household. */
export const ACCOUNT_CREATIONS: Limit = {
  name: "account-creations",
  limit: 10,
  window: "1 hour",
};

/**
 * Rate limits writes per client (`RATE_LIMIT`), so one client can't fill the
 * database or the server's time. Speaker reads are never limited: a
 * household's speakers share one address and boot together.
 */
const middlewareFor = (limit: Limit) =>
  Effect.gen(function* () {
    if (!(yield* RateLimitEnabled)) {
      return <Value, Failure, Requirements>(
        httpEffect: Effect.Effect<Value, Failure, Requirements>,
      ) => httpEffect;
    }
    const limiter = yield* RateLimiter.RateLimiter;
    return <Value, Failure, Requirements>(
      httpEffect: Effect.Effect<Value, Failure, Requirements>,
    ) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* limiter
          .consume({
            algorithm: "token-bucket",
            key: `${limit.name}:${clientOf(request)}`,
            limit: limit.limit,
            window: limit.window,
          })
          .pipe(
            Effect.catchTag("RateLimiterError", (error) =>
              error.reason._tag === "RateLimitExceeded"
                ? Effect.fail(new TooManyRequests())
                : Effect.die(error),
            ),
          );
        return yield* httpEffect;
      });
  });

export class SpeakerWriteRateLimit extends HttpApiMiddleware.Service<SpeakerWriteRateLimit>()(
  "@revive-st/api/SpeakerWriteRateLimit",
  { error: TooManyRequests },
) {}

export class PresetSyncRateLimit extends HttpApiMiddleware.Service<PresetSyncRateLimit>()(
  "@revive-st/api/PresetSyncRateLimit",
  { error: TooManyRequests },
) {}

export class AccountCreationRateLimit extends HttpApiMiddleware.Service<AccountCreationRateLimit>()(
  "@revive-st/api/AccountCreationRateLimit",
  { error: TooManyRequests },
) {}

/** The rate limit middlewares, sharing one in-memory store. */
export const RateLimitLayer = Layer.mergeAll(
  Layer.effect(SpeakerWriteRateLimit, middlewareFor(SPEAKER_WRITES)),
  Layer.effect(PresetSyncRateLimit, middlewareFor(PRESET_SYNCS)),
  Layer.effect(AccountCreationRateLimit, middlewareFor(ACCOUNT_CREATIONS)),
).pipe(
  Layer.provide(RateLimiter.layer),
  Layer.provide(RateLimiter.layerStoreMemory),
);
