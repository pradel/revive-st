/**
 * The tools a release drives: the repository's git checkout, its GitHub
 * Releases (`gh`), EAS builds (`eas-cli`) and APK files (`curl`,
 * `apksigner`). The release logic only sees these services, so its tests
 * swap in fakes.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";

import {
  Context,
  Effect,
  FileSystem,
  Layer,
  Option,
  Schema,
  type Scope,
} from "effect";

import { CommandFailed, Shell } from "./process.ts";

export const REPO_ROOT = join(import.meta.dirname, "../../..");
const APP_DIR = join(REPO_ROOT, "apps/app");
const EAS_CLI = ["-s", "eas-cli@latest"];

export type Platform = "all" | "ios" | "android";

/** An EAS build, as `eas build --json` and `eas build:list --json` print it. */
const EasBuild = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  appVersion: Schema.optional(Schema.String),
  expirationDate: Schema.optional(Schema.String),
  artifacts: Schema.optional(
    Schema.Struct({ applicationArchiveUrl: Schema.optional(Schema.String) }),
  ),
});
export type EasBuild = typeof EasBuild.Type;

const GitHubRelease = Schema.Struct({
  url: Schema.String,
  assets: Schema.Array(Schema.Struct({ name: Schema.String })),
});
export type GitHubRelease = typeof GitHubRelease.Type;

/** Decodes a tool's JSON output; output it can't read is a bug, not a result. */
const decodeJson = <
  Output extends Schema.Top & { readonly DecodingServices: never },
>(
  schema: Output,
  json: string,
) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(json).pipe(
    Effect.orDie,
  );

/** The repository's working copy. */
export class Repo extends Context.Service<
  Repo,
  {
    readonly isClean: Effect.Effect<boolean, CommandFailed>;
    /** Checks out `main` and pulls it, with its tags. */
    readonly updateMain: Effect.Effect<void, CommandFailed>;
    /** The version in apps/app/package.json. */
    readonly appVersion: Effect.Effect<string>;
    /** The commit `tag` points to. */
    readonly tagCommit: (tag: string) => Effect.Effect<string, CommandFailed>;
    /** Checks out `main`, or a tag as a detached head. */
    readonly checkout: (ref: string) => Effect.Effect<void, CommandFailed>;
  }
>()("@revive-st/release/Repo") {
  static readonly layer = Layer.effect(
    Repo,
    Effect.gen(function* () {
      const shell = yield* Shell;
      const fs = yield* FileSystem.FileSystem;
      const git = (args: readonly string[]) =>
        shell.interactive("git", args, { cwd: REPO_ROOT });
      return Repo.of({
        isClean: shell
          .output("git", ["status", "--porcelain"], { cwd: REPO_ROOT })
          .pipe(Effect.map((status) => status === "")),
        updateMain: Effect.andThen(
          git(["checkout", "--quiet", "main"]),
          git(["pull", "--quiet", "--tags", "origin", "main"]),
        ),
        appVersion: fs.readFileString(join(APP_DIR, "package.json")).pipe(
          Effect.orDie,
          Effect.flatMap((json) =>
            decodeJson(Schema.Struct({ version: Schema.String }), json),
          ),
          Effect.map(({ version }) => version),
        ),
        tagCommit: (tag) =>
          shell.output("git", ["rev-list", "-n", "1", tag], { cwd: REPO_ROOT }),
        checkout: (ref) =>
          git(
            ref === "main"
              ? ["checkout", "--quiet", "main"]
              : ["checkout", "--quiet", "--detach", ref],
          ),
      });
    }),
  );
}

/** The repository's GitHub Releases. */
export class GitHub extends Context.Service<
  GitHub,
  {
    readonly release: (
      tag: string,
    ) => Effect.Effect<Option.Option<GitHubRelease>, CommandFailed>;
    readonly upload: (
      tag: string,
      file: string,
    ) => Effect.Effect<void, CommandFailed>;
  }
>()("@revive-st/release/GitHub") {
  static readonly layer = Layer.effect(
    GitHub,
    Effect.gen(function* () {
      const shell = yield* Shell;
      return GitHub.of({
        release: Effect.fn("GitHub.release")(function* (tag: string) {
          const args = ["release", "view", tag, "--json", "url,assets"];
          const result = yield* shell.exec("gh", args, {
            cwd: REPO_ROOT,
            captureStderr: true,
          });
          if (result.exitCode === 0) {
            return Option.some(yield* decodeJson(GitHubRelease, result.stdout));
          }
          if (result.stderr.includes("release not found")) {
            return Option.none();
          }
          return yield* new CommandFailed({
            command: ["gh", ...args].join(" "),
            exitCode: result.exitCode,
            stderr: result.stderr,
          });
        }),
        upload: (tag, file) =>
          shell.interactive("gh", ["release", "upload", tag, file], {
            cwd: REPO_ROOT,
          }),
      });
    }),
  );
}

/** EAS builds of the app. */
export class Eas extends Context.Service<
  Eas,
  {
    /** Finished builds of `profile`, newest first. */
    readonly finishedBuilds: (filter: {
      readonly platform: Platform;
      readonly profile: string;
      readonly commit?: string;
      readonly appVersion?: string;
    }) => Effect.Effect<readonly EasBuild[], CommandFailed>;
    /**
     * Builds the Android app with `profile` and waits for it. It never creates
     * credentials, so it can't sign with a new key.
     */
    readonly buildAndroid: (
      profile: string,
    ) => Effect.Effect<EasBuild, CommandFailed>;
    /** Builds for the stores, attached to the terminal for EAS's prompts. */
    readonly storeBuild: (options: {
      readonly platform: Platform;
      readonly profile: string;
      readonly autoSubmit: boolean;
    }) => Effect.Effect<void, CommandFailed>;
  }
>()("@revive-st/release/Eas") {
  static readonly layer = Layer.effect(
    Eas,
    Effect.gen(function* () {
      const shell = yield* Shell;
      // `--json` prints only JSON on stdout; EAS's progress goes to stderr.
      const builds = (args: readonly string[]) =>
        shell
          .output("vpx", [...EAS_CLI, ...args, "--json"], { cwd: APP_DIR })
          .pipe(
            Effect.flatMap((json) => decodeJson(Schema.Array(EasBuild), json)),
          );
      return Eas.of({
        finishedBuilds: ({ platform, profile, commit, appVersion }) =>
          builds([
            "build:list",
            "--platform",
            platform,
            "--build-profile",
            profile,
            "--status",
            "finished",
            ...(commit ? ["--git-commit-hash", commit] : []),
            ...(appVersion ? ["--app-version", appVersion] : []),
          ]),
        buildAndroid: (profile) =>
          builds([
            "build",
            "--platform",
            "android",
            "--profile",
            profile,
            "--non-interactive",
            "--freeze-credentials",
            "--wait",
          ]).pipe(
            Effect.flatMap(([build]) =>
              build
                ? Effect.succeed(build)
                : Effect.die(new Error("`eas build` printed no build")),
            ),
          ),
        storeBuild: ({ platform, profile, autoSubmit }) =>
          shell.interactive(
            "vpx",
            [
              ...EAS_CLI,
              "build",
              "--platform",
              platform,
              "--profile",
              profile,
              ...(autoSubmit ? ["--auto-submit"] : []),
            ],
            { cwd: APP_DIR },
          ),
      });
    }),
  );
}

/** Android APK files. */
export class Apk extends Context.Service<
  Apk,
  {
    /**
     * Downloads `url` to a temporary `fileName`, deleted when the scope
     * closes, and returns its path.
     */
    readonly download: (
      url: string,
      fileName: string,
    ) => Effect.Effect<string, CommandFailed, Scope.Scope>;
    /** The SHA-256 digests of the certificates that signed `apk`. */
    readonly signingCertificates: (
      apk: string,
    ) => Effect.Effect<readonly string[], CommandFailed>;
  }
>()("@revive-st/release/Apk") {
  static readonly layer = Layer.effect(
    Apk,
    Effect.gen(function* () {
      const shell = yield* Shell;
      const fs = yield* FileSystem.FileSystem;
      return Apk.of({
        download: Effect.fn("Apk.download")(function* (
          url: string,
          fileName: string,
        ) {
          const directory = yield* fs
            .makeTempDirectoryScoped({ prefix: "revive-st-" })
            .pipe(Effect.orDie);
          const file = join(directory, fileName);
          // curl shows progress and retries: the APK is large, and a dropped
          // connection shouldn't lose a finished build.
          yield* shell.interactive(
            "curl",
            [
              "--fail",
              "--location",
              "--retry",
              "5",
              "--retry-all-errors",
              "--output",
              file,
              url,
            ],
            { cwd: REPO_ROOT },
          );
          return file;
        }),
        signingCertificates: Effect.fn("Apk.signingCertificates")(function* (
          apk: string,
        ) {
          const sdk =
            env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk");
          const buildTools = join(sdk, "build-tools");
          const versions = yield* fs
            .readDirectory(buildTools)
            .pipe(Effect.orElseSucceed((): string[] => []));
          const newest = versions
            .toSorted((a, b) => a.localeCompare(b, "en", { numeric: true }))
            .at(-1);
          if (!newest) {
            return yield* Effect.die(
              new Error(
                `No Android SDK build-tools in ${buildTools}: install them, or set ANDROID_HOME.`,
              ),
            );
          }
          const printed = yield* shell.output(
            join(buildTools, newest, "apksigner"),
            ["verify", "--print-certs", apk],
            { cwd: REPO_ROOT },
          );
          return [
            ...printed.matchAll(/certificate SHA-256 digest: ([0-9a-f]{64})/gu),
          ].map((match) => match[1]);
        }),
      });
    }),
  );
}
