import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api";

import packageJson from "../../package.json" with { type: "json" };

export const SERVER_NAME = "Revive ST API";
/** The `@revive-st/api` release, bumped by Changesets. */
export const SERVER_VERSION = packageJson.version;
export const OPENAPI_PATH = "/openapi.json";
export const DOCS_PATH = "/docs";

export const ServerStatus = Schema.Struct({
  name: Schema.Literal(SERVER_NAME),
  version: Schema.String.annotate({
    description: "The server's release, e.g. `0.3.0`.",
  }),
  docs: Schema.Literal(DOCS_PATH).annotate({
    description: "The API reference.",
  }),
  openapi: Schema.Literal(OPENAPI_PATH).annotate({
    description: "The OpenAPI document.",
  }),
}).annotate({ description: "The server and where its documentation is." });
/** The server's own root, for people and health checks. */
export class ServerApi extends HttpApiGroup.make("server")
  .add(
    HttpApiEndpoint.get("status", "/", { success: ServerStatus }).annotateMerge(
      OpenApi.annotations({
        summary: "Get the server status",
        description:
          "Answers whenever the server is up, with the version it runs and links to its documentation. Use it as a health check.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Server",
      description: "The server itself.",
    }),
  ) {}
