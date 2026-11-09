import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Cause, Exit, Layer, Runtime } from "effect";
import { FetchHttpClient } from "effect/http";
import { OtlpSerialization, OtlpTracer } from "effect/observability";

import { ServerPort } from "./config.ts";
import { DeviceContactsRepo } from "./devices/device-contacts-repo.ts";
import { DevicesRepo } from "./devices/devices-repo.ts";
import { EtagCasingServerResponse } from "./etag-header.ts";
import { HttpAppLayer } from "./http.ts";
import { LoggingLayer } from "./logging.ts";
import { PresetsRepo } from "./presets/presets-repo.ts";
import { RadioBrowser } from "./radio-browser/radio-browser.ts";
import { RateLimits } from "./rate-limit.ts";
import { TuneIn } from "./tunein/tunein.ts";

const MainLayer = HttpAppLayer.pipe(
  Layer.provide(RateLimits.layer),
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
);

/**
 * Exports spans over OTLP/HTTP protobuf when `OTEL_TRACES_EXPORTER=otlp` and an
 * OTLP endpoint are set (Railway provides the endpoint, headers and service
 * name once tracing is on); otherwise a no-op.
 */
const TracingLayer = OtlpTracer.layerFromConfig().pipe(
  Layer.provide([OtlpSerialization.layerProtobuf, FetchHttpClient.layer]),
);

/**
 * A stop signal (SIGTERM, SIGINT) ends the server with code 0 rather than
 * Effect's 130: Litestream, which runs the server when backups are on
 * (`start.sh`), only syncs the last changes after a server it stopped exits
 * cleanly.
 */
const teardown: Runtime.Teardown = (exit, onExit) => {
  if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
    onExit(0);
  } else {
    Runtime.defaultTeardown(exit, onExit);
  }
};

// Provided last so every layer build and request is traced and logged with
// them, the exporter's own errors included.
Layer.launch(
  MainLayer.pipe(Layer.provide(TracingLayer), Layer.provide(LoggingLayer)),
).pipe(NodeRuntime.runMain({ teardown }));
