/**
 * Helpers for tests that drive the emulated speaker through
 * bose-api-speaker-client, as the app does.
 */
import net from "node:net";

import type { Result } from "better-result";
import { BoseHttpAdapter, TelnetClient } from "bose-api-speaker-client";
import { Effect, Schedule } from "effect";

import { SpeakerEmulator } from "./emulator.ts";

/** The value of a speaker client call; dies when the client reports an error. */
export const orDie = <Value, Failure>(
  request: () => Promise<Result<Value, Failure>>,
) =>
  Effect.flatMap(Effect.promise(request), (result) =>
    result.isOk() ? Effect.succeed(result.value) : Effect.die(result.error),
  );

/** Retries `check` until it gives a value, for what the speaker does in the background. */
export const eventually = <Value>(check: Effect.Effect<Value | undefined>) =>
  check.pipe(
    Effect.flatMap((value) =>
      value === undefined
        ? Effect.fail("not yet" as const)
        : Effect.succeed(value),
    ),
    Effect.retry(Schedule.spaced("20 millis")),
    Effect.timeout("3 seconds"),
    Effect.orDie,
  );

/** The HTTP client for the speaker's API. */
export const speakerHttp = Effect.gen(function* () {
  const speaker = yield* SpeakerEmulator;
  return new BoseHttpAdapter({ ip: speaker.host, port: speaker.ports.http });
});

/** A connection to the speaker's TAP console, closed with the scope. */
export const openConsole = Effect.gen(function* () {
  const speaker = yield* SpeakerEmulator;
  const client = new TelnetClient({
    host: speaker.host,
    port: speaker.ports.console,
    socket: net,
  });
  yield* orDie(async () => client.connect());
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      client.disconnect();
    }),
  );
  return {
    /** The console's reply to `command`. */
    run: (command: string) =>
      orDie(async () => client.executeCommand(command, { quietMs: 50 })),
    /** `sys reboot`, which the speaker answers by hanging up; resolves once it has booted. */
    reboot: Effect.gen(function* () {
      const reply = yield* Effect.promise(async () =>
        client.executeCommand("sys reboot", { quietMs: 50 }),
      );
      if (!(reply.isErr() && reply.error.reason === "closed")) {
        return yield* Effect.die(
          new Error("The speaker didn't hang up on `sys reboot`"),
        );
      }
      yield* speaker.booted;
    }),
  };
});
