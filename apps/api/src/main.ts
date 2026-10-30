import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { ServerPort } from "./config.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { EtagCasingServerResponse } from "./etag-header.ts";
import { HttpAppLayer } from "./http.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { RadioBrowser } from "./radio-browser/radio-browser.ts";
import { TuneIn } from "./tunein/tunein.ts";

const MainLayer = HttpAppLayer.pipe(
  Layer.provide([
    PresetsRepo.layer,
    DevicesRepo.layer,
    TuneIn.layer,
    RadioBrowser.layer,
  ]),
  Layer.provide(
    NodeHttpServer.layerConfig(
      () => createServer({ ServerResponse: EtagCasingServerResponse }),
      { port: ServerPort },
    ),
  ),
);

Layer.launch(MainLayer).pipe(NodeRuntime.runMain);
