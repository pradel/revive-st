/**
 * `vp run release:app` and `vp run release:store` (see apps/app/README.md).
 * Needs `gh` and EAS logged in (`gh auth login`, `vpx eas-cli@latest login`)
 * and, for the APK, the Android SDK build-tools (from ANDROID_HOME, else
 * ~/Library/Android/sdk).
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import { CliError, Command, Flag } from "effect/cli";

import { Shell } from "./process.ts";
import { releaseApk, releaseStore } from "./release.ts";
import { Apk, Eas, GitHub, Repo } from "./tools.ts";

const apk = Command.make("apk", {}, () => releaseApk).pipe(
  Command.withDescription(
    "Build the released app version's APK on EAS and attach it to its GitHub Release.",
  ),
);

const store = Command.make(
  "store",
  {
    platform: Flag.Literals("platform", ["all", "ios", "android"]).pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Platforms to build"),
      Flag.withDefault("all"),
    ),
    autoSubmit: Flag.Boolean("auto-submit").pipe(
      Flag.withAlias("a"),
      Flag.withDescription("Submit the builds to the stores"),
      Flag.withDefault(false),
    ),
  },
  (options) => releaseStore(options),
).pipe(
  Command.withDescription("Build the released app version for the stores."),
);

const ToolsLayer = Layer.mergeAll(
  Repo.layer,
  GitHub.layer,
  Eas.layer,
  Apk.layer,
).pipe(Layer.provide(Shell.layer), Layer.provideMerge(NodeServices.layer));

Command.make("release").pipe(
  Command.withDescription("Ship the released app version."),
  Command.withSubcommands([apk, store]),
  Command.run({ version: "0.0.0" }),
  // The CLI prints its own errors (bad flags) with the help text.
  Effect.tapError((error) =>
    CliError.isCliError(error)
      ? Effect.void
      : Console.error(`❌ ${error.message}`),
  ),
  Effect.provide(ToolsLayer),
  NodeRuntime.runMain({ disableErrorReporting: true }),
);
