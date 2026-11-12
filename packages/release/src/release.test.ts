import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";

import {
  APP_SIGNING_CERT_SHA256,
  BuildUnusable,
  DirtyWorkingTree,
  ReleaseNotFound,
  releaseApk,
  releaseStore,
  ServerNotReady,
  StoreBuildExists,
  WrongSigningKey,
} from "./release.ts";
import {
  Apk,
  Eas,
  type EasBuild,
  GitHub,
  type GitHubRelease,
  Repo,
  Server,
  ServerUnreachable,
} from "./tools.ts";

const VERSION = "1.2.3";
const TAG = `@revive-st/app@${VERSION}`;
const NOW = Date.parse("2026-11-08T12:00:00Z");
const SERVER_URL = "https://api.revivest.app";
const MIN_SERVER_VERSION = "0.0.6";

const build = (id: string, overrides: Partial<EasBuild> = {}): EasBuild => ({
  id,
  status: "FINISHED",
  appVersion: VERSION,
  expirationDate: "2026-12-01T00:00:00Z",
  artifacts: { applicationArchiveUrl: `https://expo.dev/${id}.apk` },
  ...overrides,
});

interface World {
  readonly clean: boolean;
  readonly release: GitHubRelease | undefined;
  /** Finished APK builds of the tag's commit, newest first. */
  readonly apkBuilds: readonly EasBuild[];
  /** What a new EAS build produces. */
  readonly newBuild: EasBuild;
  readonly digests: readonly string[];
  readonly storeBuilds: readonly EasBuild[];
  /** The hosted server's `GET /` body; `undefined` when it's unreachable. */
  readonly server: unknown;
}

/** Fake tools over `world`; `events` records what they were asked to do. */
const tools = (overrides: Partial<World> = {}) => {
  const world: World = {
    clean: true,
    release: { url: "https://github.com/release", assets: [] },
    apkBuilds: [],
    newBuild: build("new"),
    digests: [APP_SIGNING_CERT_SHA256],
    storeBuilds: [],
    server: { name: "Revive ST API", version: MIN_SERVER_VERSION },
    ...overrides,
  };
  const events: string[] = [];
  const record = (event: string) =>
    Effect.sync(() => {
      events.push(event);
    });
  const layer = Layer.mergeAll(
    Layer.succeed(Repo, {
      isClean: Effect.succeed(world.clean),
      updateMain: record("update main"),
      appVersion: Effect.succeed(VERSION),
      appServer: Effect.succeed({
        url: SERVER_URL,
        minimum: MIN_SERVER_VERSION,
      }),
      tagCommit: () => Effect.succeed("c0ffee0"),
      checkout: (ref) => record(`checkout ${ref}`),
    }),
    Layer.succeed(GitHub, {
      release: () => Effect.succeed(Option.fromNullishOr(world.release)),
      upload: (tag, file) => record(`upload ${file} to ${tag}`),
    }),
    Layer.succeed(Eas, {
      finishedBuilds: ({ profile }) =>
        Effect.succeed(profile === "apk" ? world.apkBuilds : world.storeBuilds),
      buildAndroid: (profile) =>
        Effect.as(record(`eas build ${profile}`), world.newBuild),
      storeBuild: ({ platform, autoSubmit }) =>
        record(`store build ${platform}${autoSubmit ? " and submit" : ""}`),
    }),
    Layer.succeed(Apk, {
      download: (url, fileName) =>
        Effect.as(record(`download ${url}`), `/tmp/${fileName}`),
      signingCertificates: () => Effect.succeed(world.digests),
    }),
    Layer.succeed(Server, {
      status: (url) =>
        Effect.andThen(
          record(`check ${url}`),
          world.server === undefined
            ? Effect.fail(
                new ServerUnreachable({ url, reason: "connection refused" }),
              )
            : Effect.succeed(world.server),
        ),
    }),
  );
  return { events, layer };
};

describe("releaseApk", () => {
  it.effect(
    "builds the APK, checks its key, attaches it and goes back to main",
    () =>
      Effect.gen(function* () {
        const { events, layer } = tools();
        yield* releaseApk.pipe(Effect.provide(layer));
        assert.deepStrictEqual(events, [
          "update main",
          `checkout ${TAG}`,
          `check ${SERVER_URL}`,
          "eas build apk",
          "download https://expo.dev/new.apk",
          `upload /tmp/revive-st-${VERSION}.apk to ${TAG}`,
          "checkout main",
        ]);
      }),
  );

  it.effect("reuses a finished build of the tag that hasn't expired", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { events, layer } = tools({
        apkBuilds: [
          build("expired", { expirationDate: "2026-11-01T00:00:00Z" }),
          build("kept"),
        ],
      });
      yield* releaseApk.pipe(Effect.provide(layer));
      assert.isFalse(events.includes("eas build apk"));
      assert.include(events, "download https://expo.dev/kept.apk");
      assert.include(events, `upload /tmp/revive-st-${VERSION}.apk to ${TAG}`);
    }),
  );

  it.effect("does nothing when the release already has an APK", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({
        release: {
          url: "https://github.com/release",
          assets: [{ name: `revive-st-${VERSION}.apk` }],
        },
      });
      yield* releaseApk.pipe(Effect.provide(layer));
      assert.deepStrictEqual(events, [
        "update main",
        `checkout ${TAG}`,
        "checkout main",
      ]);
    }),
  );

  it.effect(
    "refuses an APK signed with another key, and goes back to main",
    () =>
      Effect.gen(function* () {
        const { events, layer } = tools({ digests: ["0".repeat(64)] });
        const error = yield* Effect.flip(
          releaseApk.pipe(Effect.provide(layer)),
        );
        assert.instanceOf(error, WrongSigningKey);
        assert.isFalse(events.some((event) => event.startsWith("upload")));
        assert.strictEqual(events.at(-1), "checkout main");
      }),
  );

  it.effect("refuses a build of another version without downloading it", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({
        newBuild: build("old", { appVersion: "1.2.2" }),
      });
      const error = yield* Effect.flip(releaseApk.pipe(Effect.provide(layer)));
      assert.instanceOf(error, BuildUnusable);
      assert.isFalse(events.some((event) => event.startsWith("download")));
      assert.strictEqual(events.at(-1), "checkout main");
    }),
  );

  it.effect("stops before checking out when the release doesn't exist", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({ release: undefined });
      const error = yield* Effect.flip(releaseApk.pipe(Effect.provide(layer)));
      assert.deepStrictEqual(error, new ReleaseNotFound({ tag: TAG }));
      assert.deepStrictEqual(events, ["update main"]);
    }),
  );

  it.effect("refuses a dirty working tree before updating main", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({ clean: false });
      const error = yield* Effect.flip(releaseApk.pipe(Effect.provide(layer)));
      assert.instanceOf(error, DirtyWorkingTree);
      assert.deepStrictEqual(events, []);
    }),
  );

  it.effect("ships when the hosted server is newer than the app needs", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({
        server: { name: "Revive ST API", version: "0.1.0" },
      });
      yield* releaseApk.pipe(Effect.provide(layer));
      assert.include(events, `upload /tmp/revive-st-${VERSION}.apk to ${TAG}`);
    }),
  );

  for (const [situation, server, found] of [
    [
      "older",
      { name: "Revive ST API", version: "0.0.5" },
      { kind: "tooOld", version: "0.0.5" },
    ],
    [
      "a prerelease of the version",
      { name: "Revive ST API", version: "0.0.6-rc.1" },
      { kind: "tooOld", version: "0.0.6-rc.1" },
    ],
    [
      "without a version",
      { name: "Revive ST API" },
      { kind: "tooOld", version: null },
    ],
    [
      "unreachable",
      undefined,
      { kind: "unreachable", reason: "connection refused" },
    ],
    [
      "not a Revive ST server",
      { name: "Something else", version: "1.0.0" },
      { kind: "notRevive" },
    ],
  ] as const) {
    it.effect(
      `refuses to build when the hosted server is ${situation}, and goes back to main`,
      () =>
        Effect.gen(function* () {
          const { events, layer } = tools({ server });
          const error = yield* Effect.flip(
            releaseApk.pipe(Effect.provide(layer)),
          );
          assert.deepStrictEqual(
            error,
            new ServerNotReady({
              url: SERVER_URL,
              minimum: MIN_SERVER_VERSION,
              found,
            }),
          );
          assert.deepStrictEqual(events, [
            "update main",
            `checkout ${TAG}`,
            `check ${SERVER_URL}`,
            "checkout main",
          ]);
        }),
    );
  }
});

describe("releaseStore", () => {
  it.effect("builds the released version from its tag", () =>
    Effect.gen(function* () {
      const { events, layer } = tools();
      yield* releaseStore({ platform: "ios", autoSubmit: true }).pipe(
        Effect.provide(layer),
      );
      assert.deepStrictEqual(events, [
        "update main",
        `checkout ${TAG}`,
        `check ${SERVER_URL}`,
        "store build ios and submit",
        "checkout main",
      ]);
    }),
  );

  it.effect("refuses a version that already has a store build", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({ storeBuilds: [build("store")] });
      const error = yield* Effect.flip(
        releaseStore({ platform: "all", autoSubmit: false }).pipe(
          Effect.provide(layer),
        ),
      );
      assert.instanceOf(error, StoreBuildExists);
      assert.isFalse(events.some((event) => event.startsWith("store build")));
    }),
  );

  it.effect("refuses to build when the hosted server is older", () =>
    Effect.gen(function* () {
      const { events, layer } = tools({
        server: { name: "Revive ST API", version: "0.0.5" },
      });
      const error = yield* Effect.flip(
        releaseStore({ platform: "all", autoSubmit: false }).pipe(
          Effect.provide(layer),
        ),
      );
      assert.instanceOf(error, ServerNotReady);
      assert.isFalse(events.some((event) => event.startsWith("store build")));
      assert.strictEqual(events.at(-1), "checkout main");
    }),
  );
});
