import { Context, Duration, Effect, Layer, Option, Schema } from "effect";
import type { HttpServerRequest } from "effect/http";
import { RateLimiter } from "effect/persistence";

import { RADIO_BROWSER_BASE_PATH, TUNEIN_BASE_PATH } from "./api/bmx.ts";
import { ClientIpHeader } from "./config.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { AccountId } from "./marge/account.ts";
import { accountIdOf, pathOf, routedPathOf } from "./request-path.ts";

/** A token bucket each client has: `limit` requests, refilled over `window`. */
interface Bucket {
  readonly name: string;
  readonly limit: number;
  readonly window: Duration.Input;
}

/**
 * Every request but `GET /`, Railway's healthcheck. A speaker's boot is about
 * ten requests, so a household behind one address stays far below it.
 */
const ALL: Bucket = { name: "all", limit: 600, window: "1 minute" };

/** Station lookups, each of which can call TuneIn or Radio Browser. */
const STATIONS: Bucket = { name: "stations", limit: 60, window: "1 minute" };

/** `POST`, `PUT` and `DELETE` requests, which write to the database. */
const WRITES: Bucket = { name: "writes", limit: 60, window: "1 minute" };

/**
 * Requests naming an account no speaker is paired with. Its id is the only
 * secret guarding a household's presets, so a client guessing ids runs out of
 * these; a new household's setup only spends a few.
 */
const ACCOUNT_MISSES: Bucket = {
  name: "account-misses",
  limit: 20,
  window: "1 hour",
};

const STATION_PATHS = [
  `${TUNEIN_BASE_PATH}/v1/playback/station/`,
  `${RADIO_BROWSER_BASE_PATH}/stations/byuuid/`,
];

const WRITE_METHODS = ["POST", "PUT", "DELETE"];

const isAccountId = Schema.is(AccountId);

/**
 * Per-client request limits, counted in memory: they restart with the server,
 * which is fine for limits against abuse.
 */
export class RateLimits extends Context.Service<
  RateLimits,
  {
    /**
     * How long the request's client must wait, when the request is over one
     * of its limits. Every bucket the request falls in spends a token.
     */
    readonly check: (
      request: HttpServerRequest.HttpServerRequest,
    ) => Effect.Effect<Option.Option<Duration.Duration>>;
  }
>()("@revive-st/api/RateLimits") {
  static readonly layer = Layer.effect(
    RateLimits,
    Effect.gen(function* () {
      const limiter = yield* RateLimiter.RateLimiter;
      const devicesRepo = yield* DevicesRepo;
      const clientIpHeader = yield* ClientIpHeader;

      /** The header's address when it carries one, else the peer's. */
      const clientOf = (request: HttpServerRequest.HttpServerRequest) => {
        const forwarded = Option.flatMap(clientIpHeader, (header) =>
          Option.fromUndefinedOr(request.headers[header]?.trim()),
        ).pipe(Option.filter((address) => address !== ""));
        return Option.getOrElse(
          Option.orElse(forwarded, () => request.peerAddress),
          () => "unknown",
        );
      };

      /** Spends `tokens` from the client's `bucket`, failing when it has fewer. */
      const take = (bucket: Bucket, client: string, tokens: number) =>
        limiter.consume({
          algorithm: "token-bucket",
          onExceeded: "fail",
          key: `${bucket.name}:${client}`,
          limit: bucket.limit,
          window: bucket.window,
          tokens,
        });

      /** Spends a token, or how long until one is left. */
      const spend = (bucket: Bucket, client: string) =>
        take(bucket, client, 1).pipe(
          Effect.as(Option.none<Duration.Duration>()),
          Effect.catchReason(
            "RateLimiterError",
            "RateLimitExceeded",
            (reason) => Effect.succeedSome(reason.retryAfter),
          ),
          Effect.orDie,
        );

      /** Nothing when a token is left, else about how long until one is. */
      const tokenLeft = (bucket: Bucket, client: string) =>
        take(bucket, client, 0).pipe(
          Effect.map(({ remaining }) =>
            remaining >= 1
              ? Option.none<Duration.Duration>()
              : Option.some(
                  // How long the bucket takes to refill one token.
                  Duration.divideUnsafe(
                    Duration.fromInputUnsafe(bucket.window),
                    bucket.limit,
                  ),
                ),
          ),
          Effect.orDie,
        );

      /** Spends a token from every bucket the request falls in, in order. */
      const check = Effect.fn("RateLimits.check")(function* (
        request: HttpServerRequest.HttpServerRequest,
      ) {
        const path = pathOf(request.url);
        if (request.method === "GET" && path === "/") {
          return Option.none<Duration.Duration>();
        }
        const client = clientOf(request);
        const buckets = [ALL];
        // Matched as the router matches routes, so another spelling of a
        // station path can't skip its bucket.
        const routedPath = routedPathOf(request.url).toLowerCase();
        if (STATION_PATHS.some((prefix) => routedPath.startsWith(prefix))) {
          buckets.push(STATIONS);
        }
        if (WRITE_METHODS.includes(request.method)) {
          buckets.push(WRITES);
        }
        for (const bucket of buckets) {
          const retryAfter = yield* spend(bucket, client);
          if (Option.isSome(retryAfter)) {
            return retryAfter;
          }
        }
        // Other ids are rejected by the endpoint itself.
        const accountId = accountIdOf(request.url);
        if (accountId === undefined || !isAccountId(accountId)) {
          return Option.none<Duration.Duration>();
        }
        const paired = yield* devicesRepo.findByAccount(accountId);
        // A client out of misses is refused known accounts too: answering
        // them would tell its guesses apart.
        return paired.length === 0
          ? yield* spend(ACCOUNT_MISSES, client)
          : yield* tokenLeft(ACCOUNT_MISSES, client);
      });

      return RateLimits.of({ check });
    }),
  ).pipe(
    Layer.provide(RateLimiter.layer),
    Layer.provide(RateLimiter.layerStoreMemory),
  );
}
