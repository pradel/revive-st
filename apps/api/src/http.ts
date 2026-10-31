import { fileURLToPath } from "node:url";

import { ByteSize, Cause, Effect, Exit, Layer, Option } from "effect";
import {
  HttpIncomingMessage,
  HttpMiddleware,
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

import { ReviveApi } from "./api/api.ts";
import { DOCS_PATH, OPENAPI_PATH } from "./api/server.ts";
import { BmxHandlers } from "./handlers/bmx.ts";
import { InternalHandlers } from "./handlers/internal.ts";
import { MargeHandlers } from "./handlers/marge.ts";
import { ServerHandlers } from "./handlers/server.ts";
import { StatsHandlers, UpdatesHandlers } from "./handlers/speaker-services.ts";

const ApiLayer = HttpApiBuilder.layer(ReviveApi, {
  openapiPath: OPENAPI_PATH,
}).pipe(
  Layer.provide([
    ServerHandlers,
    MargeHandlers,
    BmxHandlers,
    InternalHandlers,
    UpdatesHandlers,
    StatsHandlers,
  ]),
);

/**
 * The API reference, rendering the OpenAPI document. Scalar loads from
 * jsDelivr rather than being bundled into the server (3 MB).
 */
const DocsLayer = HttpApiScalar.layerCdn(ReviveApi, { path: DOCS_PATH });

/** Icons referenced by the BMX registry. */
const MediaLayer = HttpStaticServer.layer({
  root: fileURLToPath(new URL("../public/media", import.meta.url)),
  prefix: "/media",
});

const isXmlOrJson = (contentType: string | undefined) =>
  contentType !== undefined &&
  (contentType.includes("xml") || contentType.includes("json"));

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

/**
 * The build the Revive ST app names in its request headers, as log and span
 * attributes, to count the app versions still in use. None for speakers and
 * older apps, which don't send them.
 */
const appAttributes = (
  headers: HttpServerRequest.HttpServerRequest["headers"],
) => {
  const attributes: Record<string, string> = {};
  const version = headers["x-revive-app-version"];
  const platform = headers["x-revive-app-platform"];
  if (version !== undefined) {
    attributes["app.version"] = version;
  }
  if (platform !== undefined) {
    attributes["app.platform"] = platform;
  }
  return attributes;
};

/**
 * Logs responses with a 4xx or 5xx status, with the XML or JSON body of the
 * request: a 404 is how a speaker call this server lacks shows up, a 400 what
 * a speaker sent that it rejected. Other responses log at Debug; Railway's
 * HTTP logs and the request's trace already record them. Replaces Effect's
 * request logger, which would log the account id.
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
    const app = appAttributes(request.headers);
    return Effect.gen(function* () {
      yield* Effect.annotateCurrentSpan(app);
      // Read before the handler, which reads it again from the request's cache.
      const body = isXmlOrJson(request.headers["content-type"])
        ? yield* request.text.pipe(Effect.orElseSucceed(() => ""))
        : "";
      const annotate = (status: number) =>
        Effect.annotateLogs({
          "http.method": request.method,
          "http.url": path,
          "http.status": status,
          ...app,
          ...(status >= 400 && body !== ""
            ? { "http.request.body": truncateBody(redact(body)) }
            : {}),
        });
      const logAtStatus = (status: number, message: string) =>
        (status >= 500
          ? Effect.logError(message)
          : status >= 400
            ? Effect.logWarning(message)
            : Effect.logDebug(message)
        ).pipe(annotate(status));
      return yield* httpApp.pipe(
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) {
            return logAtStatus(exit.value.status, "Sent HTTP response");
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
            return Effect.logDebug("Client aborted request").pipe(
              annotate(response.status),
            );
          }
          const error = Cause.squash(cause.value);
          if (
            HttpServerError.isHttpServerError(error) &&
            error.reason._tag === "RouteNotFound"
          ) {
            return Effect.logWarning("No route for request").pipe(
              annotate(response.status),
            );
          }
          return logAtStatus(response.status, "HTTP request failed").pipe(
            Effect.annotateLogs("error", redact(Cause.pretty(cause.value))),
          );
        }),
      );
    });
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
 * The largest request body read. The biggest legitimate ones (six presets
 * from the app, a speaker's boot report) are a few kilobytes; a larger body
 * gets `413` before it is buffered.
 */
const MAX_BODY_SIZE = ByteSize.kibibytes(32);

/**
 * The HTTP application, served on whichever `HttpServer` is provided.
 * Requires `PresetsRepo`, `DevicesRepo`, `DeviceContactsRepo`, `TuneIn`,
 * `RadioBrowser` and the platform services of the server layer.
 */
export const HttpAppLayer = HttpRouter.serve(
  Layer.mergeAll(ApiLayer, DocsLayer, MediaLayer, NotModifiedLayer),
  {
    // Speakers register devices both with and without a trailing slash.
    routerConfig: { ignoreTrailingSlash: true },
    disableLogger: true,
    middleware: (httpApp) =>
      trustForwardedHeaders(logResponses(httpApp)).pipe(
        Effect.provideService(HttpIncomingMessage.MaxBodySize, MAX_BODY_SIZE),
      ),
  },
);
