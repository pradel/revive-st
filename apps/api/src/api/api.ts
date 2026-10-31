import { HttpApi, OpenApi } from "effect/http-api";

import { BmxApi } from "./bmx.ts";
import { InternalApi } from "./internal.ts";
import { MargeApi } from "./marge.ts";
import { SERVER_NAME, SERVER_VERSION, ServerApi } from "./server.ts";
import { StatsApi, UpdatesApi } from "./speaker-services.ts";

/**
 * Each path and query parameter's OpenAPI description. Set on the parameter
 * rather than its schema: Effect documents an integer path parameter as a
 * numeric string without its checks, so `presetId` also gets its schema here.
 */
const PARAMETERS: Record<
  string,
  { readonly description: string; readonly schema?: object }
> = {
  accountId: {
    description:
      "The household's Marge account id (the speaker's `margeAccountUUID`). Knowing it grants access to the household's presets.",
  },
  deviceId: {
    description:
      "The speaker's device id: its MAC address, e.g. `EC1127C25A50`.",
  },
  presetId: {
    description: "The preset button.",
    schema: { type: "integer", minimum: 1, maximum: 6 },
  },
  stationId: { description: "A TuneIn guide id, e.g. `s24861`." },
  stationUuid: {
    description:
      "A Radio Browser station's `stationuuid`, e.g. `9610c454-0601-11e8-ae97-52543be04c81`.",
  },
  data: {
    description:
      'A custom station: base64 of `{"streamUrl","name","imageUrl"}`, where `streamUrl` is an `http` or `https` URL.',
  },
};

const METHODS = ["get", "put", "post", "delete"] as const;

const describeParameters = (
  parameters: OpenApi.OpenAPISpecParameter[],
): OpenApi.OpenAPISpecParameter[] =>
  parameters.map((parameter) => {
    const documented = PARAMETERS[parameter.name];
    return (parameter.in === "path" || parameter.in === "query") &&
      documented !== undefined
      ? { ...parameter, ...documented }
      : parameter;
  });

/**
 * Applies `describeParameters` to every operation. `transform` receives
 * the document `OpenApi.fromApi` generated, typed as a plain record.
 */
const describeOperations = (openApiSpec: Record<string, unknown>) => {
  const spec = openApiSpec as unknown as OpenApi.OpenAPISpec;
  for (const pathItem of Object.values(spec.paths)) {
    for (const operation of METHODS.map((method) => pathItem[method])) {
      if (operation !== undefined) {
        operation.parameters = describeParameters(operation.parameters);
      }
    }
  }
  return spec;
};

export class ReviveApi extends HttpApi.make("revive-st")
  .add(ServerApi)
  .add(MargeApi)
  .add(BmxApi)
  .add(InternalApi)
  .add(UpdatesApi)
  .add(StatsApi)
  .annotateMerge(
    OpenApi.annotations({
      title: SERVER_NAME,
      version: SERVER_VERSION,
      description: [
        "The Revive ST server: it emulates the Bose SoundTouch Marge streaming server, BMX services, software update index and stats endpoints for SoundTouch speakers, and backs the Revive ST app.",
        "Each household has its own Marge account, and presets are stored per account and device. Knowing a household's account id is what grants access to its presets: no endpoint takes credentials.",
        "Besides these endpoints, the server serves the icons the BMX registry links to under `/media/`.",
      ].join("\n\n"),
      externalDocs: {
        description: "Revive ST developer documentation",
        url: "https://www.revivest.app/docs/developers/api",
      },
      transform: describeOperations,
    }),
  ) {}
