import { fileURLToPath } from "node:url";

import { Effect, Layer } from "effect";
import {
  HttpMiddleware,
  HttpRouter,
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

/** Logs XML and JSON bodies: the record of what speakers actually send. */
const LogBodiesLayer = HttpRouter.middleware(
  (httpEffect) =>
    HttpServerRequest.HttpServerRequest.use((request) =>
      Effect.gen(function* () {
        if (isXmlOrJson(request.headers["content-type"])) {
          const body = yield* request.text.pipe(Effect.orElseSucceed(() => ""));
          if (body !== "") {
            yield* Effect.logInfo("Request body", truncateBody(body));
          }
        }
        const response = yield* httpEffect;
        if (
          isXmlOrJson(response.headers["content-type"]) &&
          response.body._tag === "Uint8Array"
        ) {
          yield* Effect.logInfo(
            "Response body",
            truncateBody(textDecoder.decode(response.body.body)),
          ).pipe(Effect.annotateLogs("http.status", response.status));
        }
        return response;
      }).pipe(
        Effect.annotateLogs({
          "http.method": request.method,
          "http.url": pathOf(request.url),
        }),
      ),
    ),
  { global: true },
);

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
 * Requires `PresetsRepo`, `TuneIn` and the platform services of the server
 * layer.
 */
export const HttpAppLayer = HttpRouter.serve(
  Layer.mergeAll(ApiLayer, MediaLayer, NotModifiedLayer, LogBodiesLayer),
  {
    // Speakers register devices both with and without a trailing slash.
    routerConfig: { ignoreTrailingSlash: true },
    // `HttpMiddleware` erases types to `any`; this one only rewrites the
    // request, so the app's own types still hold.
    middleware: (httpApp) => trustForwardedHeaders(httpApp) as typeof httpApp,
  },
);
