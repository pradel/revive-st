import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { ServerPort } from "./config.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";

const MainLayer = HttpAppLayer.pipe(
  Layer.provide(PresetsRepo.layer),
  Layer.provide(NodeHttpServer.layerConfig(createServer, { port: ServerPort })),
);

Layer.launch(MainLayer).pipe(NodeRuntime.runMain);
