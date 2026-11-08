import { Context, Data, Effect, Layer, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/** A command exited with a non-zero code. */
export class CommandFailed extends Data.TaggedError("CommandFailed")<{
  readonly command: string;
  readonly exitCode: number;
  readonly stderr: string;
}> {
  override get message() {
    const detail = this.stderr.trim();
    return `\`${this.command}\` failed with exit code ${this.exitCode}${detail ? `: ${detail}` : ""}`;
  }
}

/** Runs the commands the tools are made of. */
export class Shell extends Context.Service<
  Shell,
  {
    /**
     * Runs a command and collects its output. Its stderr goes to the
     * terminal, where it shows progress, unless `captureStderr` is set.
     */
    readonly exec: (
      command: string,
      args: readonly string[],
      options: { readonly cwd: string; readonly captureStderr?: boolean },
    ) => Effect.Effect<{
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
    }>;
    /** Runs a command and returns its trimmed stdout; fails unless it exits 0. */
    readonly output: (
      command: string,
      args: readonly string[],
      options: { readonly cwd: string },
    ) => Effect.Effect<string, CommandFailed>;
    /** Runs a command attached to the terminal; fails unless it exits 0. */
    readonly interactive: (
      command: string,
      args: readonly string[],
      options: { readonly cwd: string },
    ) => Effect.Effect<void, CommandFailed>;
  }
>()("@revive-st/release/Shell") {
  static readonly layer = Layer.effect(
    Shell,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

      const exec = Effect.fn("Shell.exec")(
        function* (
          command: string,
          args: readonly string[],
          options: { readonly cwd: string; readonly captureStderr?: boolean },
        ) {
          const handle = yield* spawner.spawn(
            ChildProcess.make(command, args, {
              cwd: options.cwd,
              stdin: "ignore",
              stderr: options.captureStderr ? "pipe" : "inherit",
            }),
          );
          const [stdout, stderr] = yield* Effect.all(
            [handle.stdout, handle.stderr].map((stream) =>
              stream.pipe(Stream.decodeText(), Stream.mkString),
            ),
            { concurrency: 2 },
          );
          const exitCode = yield* handle.exitCode;
          return { exitCode, stdout, stderr };
        },
        Effect.scoped,
        // A command that can't start (not installed, say) is a broken setup,
        // not an outcome a release handles.
        Effect.orDie,
      );

      const output = Effect.fn("Shell.output")(function* (
        command: string,
        args: readonly string[],
        options: { readonly cwd: string },
      ) {
        const result = yield* exec(command, args, options);
        if (result.exitCode !== 0) {
          return yield* new CommandFailed({
            command: [command, ...args].join(" "),
            exitCode: result.exitCode,
            stderr: result.stderr,
          });
        }
        return result.stdout.trim();
      });

      const interactive = Effect.fn("Shell.interactive")(function* (
        command: string,
        args: readonly string[],
        options: { readonly cwd: string },
      ) {
        const exitCode = yield* spawner
          .exitCode(
            ChildProcess.make(command, args, {
              cwd: options.cwd,
              stdin: "inherit",
              stdout: "inherit",
              stderr: "inherit",
            }),
          )
          .pipe(Effect.orDie);
        if (exitCode !== 0) {
          return yield* new CommandFailed({
            command: [command, ...args].join(" "),
            exitCode,
            stderr: "",
          });
        }
      });

      return Shell.of({ exec, output, interactive });
    }),
  );
}
