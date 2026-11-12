/**
 * Ships the app version in apps/app/package.json, once its version PR has
 * merged and the Release workflow has created the GitHub Release
 * `@revive-st/app@<version>`. Both releases build from that release's tag, so
 * what ships is what was released even if `main` has moved on, and leave the
 * checkout on `main` however they end.
 */
import { Clock, Console, Data, Effect, Option } from "effect";

import {
  Apk,
  Eas,
  type EasBuild,
  GitHub,
  type GitHubRelease,
  type Platform,
  Repo,
  Server,
} from "./tools.ts";

/**
 * SHA-256 of the certificate the app is signed with: the EAS keystore
 * (`eas credentials`), which Google Play will also use. A phone only updates
 * the app with an APK signed by the same key.
 */
export const APP_SIGNING_CERT_SHA256 =
  "338f03c556575ca1dc01abd9d2852bed86cc1ec388c15bf097e378fdd3272212";
export const APK_PROFILE = "apk";
export const STORE_PROFILE = "production";
/** What a Revive ST server's `GET /` names itself (`SERVER_NAME` in `apps/api`). */
export const REVIVE_SERVER_NAME = "Revive ST API";

export class DirtyWorkingTree extends Data.TaggedError("DirtyWorkingTree") {
  override readonly message =
    "The working tree isn't clean: commit or stash first.";
}

export class ReleaseNotFound extends Data.TaggedError("ReleaseNotFound")<{
  readonly tag: string;
}> {
  override get message() {
    return `No GitHub Release ${this.tag}: merge the version PR and let the Release workflow finish first.`;
  }
}

export class BuildUnusable extends Data.TaggedError("BuildUnusable")<{
  readonly build: EasBuild;
  readonly version: string;
}> {
  override get message() {
    const { id, status, appVersion } = this.build;
    return status === "FINISHED"
      ? `EAS build ${id} is version ${appVersion ?? "unknown"}, not ${this.version}.`
      : `EAS build ${id} didn't finish (${status}).`;
  }
}

export class WrongSigningKey extends Data.TaggedError("WrongSigningKey")<{
  readonly digests: readonly string[];
}> {
  override get message() {
    return (
      `The APK is signed with ${this.digests.join(", ") || "no certificate"}, not the app's key ${APP_SIGNING_CERT_SHA256}. ` +
      "Phones with the app installed would refuse it: don't publish it. Check `eas credentials` (apps/app/README.md)."
    );
  }
}

export class StoreBuildExists extends Data.TaggedError("StoreBuildExists")<{
  readonly version: string;
  readonly platform: Platform;
}> {
  override get message() {
    return `Version ${this.version} already has a store build for ${this.platform}. Release a new version to build again.`;
  }
}

/** What the hosted server turned out to be, when it's not one the app works with. */
type HostedServer =
  | { readonly kind: "unreachable"; readonly reason: string }
  | { readonly kind: "notRevive" }
  /** `version` is `null` when the server didn't report one. */
  | { readonly kind: "tooOld"; readonly version: string | null };

export class ServerNotReady extends Data.TaggedError("ServerNotReady")<{
  readonly url: string;
  readonly minimum: string;
  readonly found: HostedServer;
}> {
  override get message() {
    const { found } = this;
    const what =
      found.kind === "unreachable"
        ? `can't be reached (${found.reason})`
        : found.kind === "notRevive"
          ? "isn't a Revive ST server"
          : found.version === null
            ? "runs a release that doesn't report its version"
            : `runs ${found.version}`;
    return (
      `This app version needs Revive ST ${this.minimum} or newer on ${this.url}, which ${what}. ` +
      "Shipping it would break setup for every user: deploy the API release first (merge its version PR and let Railway redeploy), then run this again."
    );
  }
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/**
 * Whether `version` is `minimum` or newer, by semver precedence: a prerelease
 * comes before its release. The same rule as `isAtLeast` in apps/app's
 * server-version.ts, which decides whether the app accepts a server.
 */
function isAtLeast(version: string, minimum: string): boolean {
  const have = RELEASE.exec(version);
  const need = RELEASE.exec(minimum);
  if (!have || !need) {
    return false;
  }
  for (let part = 1; part <= 3; part++) {
    const difference = Number(have[part]) - Number(need[part]);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return have[4] === undefined;
}

/**
 * Fails unless the server the checked-out app defaults to runs the oldest
 * release it works with, or newer: the app and its server are released
 * separately, and the app refuses an older server.
 */
const requireHostedServer = Effect.gen(function* () {
  const repo = yield* Repo;
  const server = yield* Server;
  const { url, minimum } = yield* repo.appServer;
  yield* Console.log(`🌐 Checking that ${url} runs Revive ST ${minimum}+...`);
  const status = yield* server.status(url).pipe(
    Effect.catchTag("ServerUnreachable", ({ reason }) =>
      Effect.fail(
        new ServerNotReady({
          url,
          minimum,
          found: { kind: "unreachable", reason },
        }),
      ),
    ),
  );
  const { name, version }: Record<string, unknown> =
    typeof status === "object" && status !== null ? { ...status } : {};
  if (name !== REVIVE_SERVER_NAME) {
    return yield* new ServerNotReady({
      url,
      minimum,
      found: { kind: "notRevive" },
    });
  }
  if (typeof version !== "string" || !isAtLeast(version, minimum)) {
    return yield* new ServerNotReady({
      url,
      minimum,
      found: {
        kind: "tooOld",
        version: typeof version === "string" ? version : null,
      },
    });
  }
});

interface Released {
  readonly version: string;
  readonly tag: string;
  readonly commit: string;
  readonly release: GitHubRelease;
}

/** Runs `ship` on a checkout of the released app version's tag. */
const onReleasedTag = <Shipped, Failure, Requirements>(
  ship: (released: Released) => Effect.Effect<Shipped, Failure, Requirements>,
) =>
  Effect.gen(function* () {
    const repo = yield* Repo;
    const github = yield* GitHub;
    if (!(yield* repo.isClean)) {
      return yield* new DirtyWorkingTree();
    }
    yield* Console.log("🔄 Updating main...");
    yield* repo.updateMain;

    const version = yield* repo.appVersion;
    const tag = `@revive-st/app@${version}`;
    const release = yield* github.release(tag);
    if (Option.isNone(release)) {
      return yield* new ReleaseNotFound({ tag });
    }
    const commit = yield* repo.tagCommit(tag);
    yield* Console.log(`📱 Releasing ${tag} (${commit.slice(0, 7)})`);
    return yield* Effect.acquireUseRelease(
      repo.checkout(tag),
      () => ship({ version, tag, commit, release: release.value }),
      () => repo.checkout("main").pipe(Effect.orDie),
    );
  });

/**
 * Attaches the released version's APK to its GitHub Release, built on EAS
 * unless a finished build of the tag can still be downloaded. Does nothing if
 * the release already has an APK, never attaches one signed with another key
 * than the app's, and refuses to ship while the hosted server is older than
 * the app needs.
 */
export const releaseApk = onReleasedTag(
  Effect.fn("releaseApk")(function* ({ version, tag, commit, release }) {
    const eas = yield* Eas;
    const apk = yield* Apk;
    const github = yield* GitHub;

    const attached = release.assets.find((asset) =>
      asset.name.endsWith(".apk"),
    );
    if (attached) {
      yield* Console.log(
        `✅ ${tag} already has ${attached.name}: ${release.url}`,
      );
      return;
    }
    yield* requireHostedServer;

    const now = yield* Clock.currentTimeMillis;
    const reusable = (yield* eas.finishedBuilds({
      platform: "android",
      profile: APK_PROFILE,
      commit,
    })).find(
      (build) =>
        build.artifacts?.applicationArchiveUrl !== undefined &&
        (build.expirationDate === undefined ||
          Date.parse(build.expirationDate) > now),
    );
    let build: EasBuild;
    if (reusable) {
      yield* Console.log(`♻️  Reusing finished EAS build ${reusable.id}.`);
      build = reusable;
    } else {
      yield* Console.log(`🚀 Building the APK of ${tag} on EAS...`);
      build = yield* eas.buildAndroid(APK_PROFILE);
    }
    const url = build.artifacts?.applicationArchiveUrl;
    if (build.status !== "FINISHED" || !url || build.appVersion !== version) {
      return yield* new BuildUnusable({ build, version });
    }

    yield* Effect.scoped(
      Effect.gen(function* () {
        yield* Console.log(`⬇️  Downloading ${url}`);
        const file = yield* apk.download(url, `revive-st-${version}.apk`);
        yield* Console.log("🔏 Checking the signing key...");
        const digests = yield* apk.signingCertificates(file);
        if (
          digests.length === 0 ||
          digests.some((digest) => digest !== APP_SIGNING_CERT_SHA256)
        ) {
          return yield* new WrongSigningKey({ digests });
        }
        yield* Console.log(`📦 Attaching it to ${tag}...`);
        yield* github.upload(tag, file);
      }),
    );
    yield* Console.log(`🎉 Done: ${release.url}`);
  }),
);

/**
 * Builds the released version for the stores, unless it already has a
 * finished store build for `platform` or the hosted server is older than the
 * app needs.
 */
export const releaseStore = (options: {
  readonly platform: Platform;
  readonly autoSubmit: boolean;
}) =>
  onReleasedTag(
    Effect.fn("releaseStore")(function* ({ version }) {
      const eas = yield* Eas;
      const built = yield* eas.finishedBuilds({
        platform: options.platform,
        profile: STORE_PROFILE,
        appVersion: version,
      });
      if (built.length > 0) {
        return yield* new StoreBuildExists({
          version,
          platform: options.platform,
        });
      }
      yield* requireHostedServer;
      yield* Console.log(`🚀 Building ${version} for the stores...`);
      yield* eas.storeBuild({ ...options, profile: STORE_PROFILE });
      yield* Console.log("🎉 Build finished.");
    }),
  );
