import { fileURLToPath } from "node:url";

import { Cause, Effect, Exit, Layer, Option } from "effect";
import {
  HttpMiddleware,
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { ReviveApi } from "./api/api.ts";
import { BmxHandlers } from "./handlers/bmx.ts";
import { InternalHandlers } from "./handlers/internal.ts";
import { MargeHandlers } from "./handlers/marge.ts";

const ApiLayer = HttpApiBuilder.layer(ReviveApi).pipe(
  Layer.provide([MargeHandlers, BmxHandlers, InternalHandlers]),
);

/** Icons referenced by the BMX registry. */
const MediaLayer = HttpStaticServer.layer({
  root: fileURLToPath(new URL("../public/media", import.meta.url)),
  prefix: "/media",
});

const isXmlOrJson = (contentType: string | undefined) =>
  contentType !== undefined &&
  (contentType.includes("xml") || contentType.includes("json"));

const textDecoder = new TextDecoder();

const MAX_LOGGED_BODY_LENGTH = 4096;

const truncateBody = (body: string) =>
  body.length <= MAX_LOGGED_BODY_LENGTH
    ? body
    : `${body.slice(0, MAX_LOGGED_BODY_LENGTH)}… (${body.length - MAX_LOGGED_BODY_LENGTH} more chars)`;

/** The path only: query strings carry encoded station data. */
const pathOf = (url: string) => url.split("?", 1)[0];

const ACCOUNT_SEGMENT = /(\/account\/)([^/]+)/;

/** The id `POST /api/internal/accounts` mints, in its JSON reply. */
const ACCOUNT_ID_FIELD = /("accountId"\s*:\s*")[^"]*(")/g;

const decodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * The request path with its account id masked, and a function masking it in
 * bodies. The id is the only secret guarding a household's presets, so no
 * log line may carry it.
 */
const redactedPath = (url: string) => {
  const path = pathOf(url);
  const segment = ACCOUNT_SEGMENT.exec(path)?.[2];
  const accountId =
    segment === undefined ? undefined : decodePathSegment(segment);
  return {
    path: path.replace(ACCOUNT_SEGMENT, "$1…"),
    redact: (text: string) => {
      const masked = text.replace(ACCOUNT_ID_FIELD, "$1…$2");
      return accountId === undefined
        ? masked
        : masked.replaceAll(accountId, "…");
    },
  };
};

/** Logs XML and JSON bodies: the record of what speakers actually send. */
const LogBodiesLayer = HttpRouter.middleware(
  (httpEffect) =>
    HttpServerRequest.HttpServerRequest.use((request) => {
      const { path, redact } = redactedPath(request.url);
      return Effect.gen(function* () {
        if (isXmlOrJson(request.headers["content-type"])) {
          const body = yield* request.text.pipe(Effect.orElseSucceed(() => ""));
          if (body !== "") {
            yield* Effect.logInfo("Request body", truncateBody(redact(body)));
          }
        }
        const response = yield* httpEffect;
        if (
          isXmlOrJson(response.headers["content-type"]) &&
          response.body._tag === "Uint8Array"
        ) {
          yield* Effect.logInfo(
            "Response body",
            truncateBody(redact(textDecoder.decode(response.body.body))),
          ).pipe(Effect.annotateLogs("http.status", response.status));
        }
        return response;
      }).pipe(
        Effect.annotateLogs({
          "http.method": request.method,
          "http.url": path,
        }),
      );
    }),
  { global: true },
);

/**
 * Logs every response, unrouted ones included: a 404 is how a speaker call
 * this server lacks shows up. Replaces Effect's request logger, which would
 * log the account id; like it, a request the client aborted is logged as a
 * plain response.
 */
const logResponses = <Failure, Requirements>(
  httpApp: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    Failure,
    Requirements | HttpServerRequest.HttpServerRequest
  >,
) =>
  HttpServerRequest.HttpServerRequest.use((request) => {
    const { path, redact } = redactedPath(request.url);
    const annotate = (status: number) =>
      Effect.annotateLogs({
        "http.method": request.method,
        "http.url": path,
        "http.status": status,
      });
    return httpApp.pipe(
      Effect.onExit((exit) => {
        if (Exit.isSuccess(exit)) {
          return Effect.logInfo("Sent HTTP response").pipe(
            annotate(exit.value.status),
          );
        }
        const [response, cause] = HttpServerError.causeResponseStripped(
          exit.cause,
        );
        const clientAborted =
          Option.isNone(cause) ||
          cause.value.reasons.every(
            (reason) =>
              reason._tag === "Interrupt" &&
              reason.annotations.has(HttpServerError.ClientAbort.key),
          );
        if (clientAborted) {
          return Effect.logInfo("Sent HTTP response").pipe(
            annotate(response.status),
          );
        }
        const error = Cause.squash(cause.value);
        return (
          HttpServerError.isHttpServerError(error) &&
          error.reason._tag === "RouteNotFound"
            ? Effect.logWarning("No route for request")
            : Effect.logWarning(
                "HTTP request failed",
                redact(Cause.pretty(cause.value)),
              )
        ).pipe(annotate(response.status));
      }),
    );
  });

/**
 * Answers a GET whose `If-None-Match` names the response's `ETag` with a bare
 * 304, so a speaker polling an unchanged document gets no body.
 */
const NotModifiedLayer = HttpRouter.middleware(
  (httpEffect) =>
    HttpServerRequest.HttpServerRequest.use((request) =>
      Effect.map(httpEffect, (response) => {
        const etag = response.headers.etag;
        return request.method === "GET" &&
          etag !== undefined &&
          request.headers["if-none-match"] === etag
          ? HttpServerResponse.empty({ status: 304 })
          : response;
      }),
    ),
  { global: true },
);

// Railway terminates TLS and is the only route to the server, so its
// forwarded host and protocol are trusted unconditionally.
const trustForwardedHeaders = HttpMiddleware.xForwardedHeaders({
  trustedProxies: () => true,
});

/**
 * The HTTP application, served on whichever `HttpServer` is provided.
 * Requires `PresetsRepo`, `DevicesRepo`, `TuneIn`, `RadioBrowser` and the
 * platform services of the server layer.
 */
export const HttpAppLayer = HttpRouter.serve(
  Layer.mergeAll(ApiLayer, MediaLayer, NotModifiedLayer, LogBodiesLayer),
  {
    // Speakers register devices both with and without a trailing slash.
    routerConfig: { ignoreTrailingSlash: true },
    disableLogger: true,
    // `HttpMiddleware` erases types to `any`; these only read or rewrite the
    // request, so the app's own types still hold.
    middleware: (httpApp) =>
      trustForwardedHeaders(logResponses(httpApp)) as typeof httpApp,
  },
);
