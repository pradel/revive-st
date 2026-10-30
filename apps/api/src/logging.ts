import {
  Context,
  Effect,
  Formatter,
  Layer,
  Logger,
  References,
  Tracer,
} from "effect";

import { LogFormat, MinimumLogLevel } from "./config.ts";

/**
 * One JSON object per line, as Railway's log explorer parses it: annotations
 * as top-level fields to filter on, a lowercase `level`, and the ids of the
 * current trace and span to jump from a log line to its trace.
 */
const jsonLogger = Logger.withConsoleLog(
  Logger.make((options) => {
    const { message, level, timestamp, cause, annotations } =
      Logger.formatStructured.log(options);
    const span = Context.getOrUndefined(
      options.fiber.context,
      Tracer.ParentSpan,
    );
    return Formatter.formatJson({
      ...annotations,
      message,
      level: level.toLowerCase(),
      timestamp,
      cause,
      trace_id: span?.traceId,
      span_id: span?.spanId,
    });
  }),
);

/**
 * The log level and format set by `LOG_LEVEL` and `LOG_FORMAT`. Log lines
 * keep being recorded as events of the current span.
 */
export const LoggingLayer = Layer.unwrap(
  Effect.gen(function* () {
    const level = yield* MinimumLogLevel;
    const format = yield* LogFormat;
    return Layer.mergeAll(
      Layer.succeed(References.MinimumLogLevel, level),
      format === "json"
        ? Logger.layer([jsonLogger, Logger.tracerLogger])
        : Layer.empty,
    );
  }),
);
