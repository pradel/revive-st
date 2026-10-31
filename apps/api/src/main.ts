import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization, OtlpTracer } from "effect/observability";

import { BackupLayer } from "./backup/backup.ts";
import { ServerPort } from "./config.ts";
import { Database } from "./db/database.ts";
import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { EtagCasingServerResponse } from "./etag-header.ts";
import { HttpAppLayer } from "./http.ts";
import { LoggingLayer } from "./logging.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { RadioBrowser } from "./radio-browser/radio-browser.ts";
import { TuneIn } from "./tunein/tunein.ts";

const MainLayer = Layer.mergeAll(
  HttpAppLayer.pipe(
    Layer.provide([
      PresetsRepo.layer,
      DevicesRepo.layer,
      DeviceContactsRepo.layer,
      TuneIn.layer,
      RadioBrowser.layer,
    ]),
    Layer.provide(
      NodeHttpServer.layerConfig(
        () => createServer({ ServerResponse: EtagCasingServerResponse }),
        { port: ServerPort },
      ),
    ),
  ),
  // The same `Database.layer` as the repositories: one database, built once.
  BackupLayer.pipe(Layer.provide(Database.layer)),
);

/**
 * Exports spans over OTLP/HTTP protobuf when `OTEL_TRACES_EXPORTER=otlp` and an
 * OTLP endpoint are set (Railway provides the endpoint, headers and service
 * name once tracing is on); otherwise a no-op.
 */
const TracingLayer = OtlpTracer.layerFromConfig().pipe(
  Layer.provide([OtlpSerialization.layerProtobuf, FetchHttpClient.layer]),
);

// Provided last so every layer build and request is traced and logged with
// them, the exporter's own errors included.
Layer.launch(
  MainLayer.pipe(Layer.provide(TracingLayer), Layer.provide(LoggingLayer)),
).pipe(NodeRuntime.runMain);
