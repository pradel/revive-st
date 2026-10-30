import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { ReviveApi } from "../api/api.ts";
import {
  DOCS_PATH,
  OPENAPI_PATH,
  SERVER_NAME,
  SERVER_VERSION,
} from "../api/server.ts";

const status = {
  name: SERVER_NAME,
  version: SERVER_VERSION,
  docs: DOCS_PATH,
  openapi: OPENAPI_PATH,
} as const;

export const ServerHandlers = HttpApiBuilder.group(
  ReviveApi,
  "server",
  (handlers) => handlers.handle("status", () => Effect.succeed(status)),
);
