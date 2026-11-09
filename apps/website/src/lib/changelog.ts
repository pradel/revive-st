import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ChangelogTimelineEntry } from "@/components/changelog";
import { WEBSITE_CONFIG } from "@/config";

const run = promisify(execFile);

// eslint-disable-next-line no-undef
const repoRoot = join(process.cwd(), "../..");

/**
 * The products shown, with their changesets CHANGELOG. `slug` names their tab,
 * `/changelog/<slug>`, and starts their entries' anchors, `#app-0.0.5`.
 */
export const PRODUCTS = [
  {
    slug: "app",
    name: "@revive-st/app",
    label: "App",
    changelog: "apps/app/CHANGELOG.md",
  },
  {
    slug: "server",
    name: "@revive-st/api",
    label: "Server",
    changelog: "apps/api/CHANGELOG.md",
  },
] as const;

export type ProductSlug = (typeof PRODUCTS)[number]["slug"];

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", repoRoot, ...args], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

/**
 * Release notes for readers: without changesets' "### Patch Changes"
 * headings, and without the commit hash that starts each change up to app
 * 0.0.5 and server 0.0.4 (later ones end with a link to their pull request).
 */
function notes(body: string): string {
  return body
    .replaceAll(/^### (?:Major|Minor|Patch) Changes\n+/gmu, "")
    .replaceAll(/^- [\da-f]{7,40}: /gmu, "- ")
    .trim();
}

/**
 * The commit that added each `## <version>` heading to `file`: the "version
 * packages" commit, whose push to main publishes the release.
 */
async function releaseCommits(
  file: string,
): Promise<Map<string, { hash: string; date: Date }>> {
  const log = await git(
    "log",
    "--reverse",
    "--format=%x00%H %cI",
    "--unified=0",
    "--patch",
    "--",
    file,
  );
  const commits = new Map<string, { hash: string; date: Date }>();
  for (const chunk of log.split("\0").slice(1)) {
    const [hash, date] = chunk.slice(0, chunk.indexOf("\n")).split(" ");
    for (const [, version] of chunk.matchAll(/^\+## (\S+)$/gmu)) {
      if (!commits.has(version)) {
        commits.set(version, { hash, date: new Date(date) });
      }
    }
  }
  return commits;
}

/**
 * Every release of `product`, or of every product, read from their
 * CHANGELOG.md when the site is built and dated by git. Versions not committed
 * yet are left out.
 */
export async function releases(
  product?: ProductSlug,
): Promise<ChangelogTimelineEntry[]> {
  // A shallow clone dates every release to its one commit.
  if ((await git("rev-parse", "--is-shallow-repository")).trim() === "true") {
    throw new Error(
      "The changelog dates releases from git history, which this clone lacks: run `git fetch --unshallow --tags` first.",
    );
  }
  const [head, tags] = await Promise.all([
    git("rev-parse", "HEAD"),
    git("tag", "--list", "@revive-st/*"),
  ]);
  const tagged = new Set(tags.split("\n"));

  const entries = await Promise.all(
    PRODUCTS.filter(
      ({ slug }) => product === undefined || slug === product,
    ).map(async ({ slug, name, label, changelog }) => {
      const [markdown, commits] = await Promise.all([
        readFile(join(repoRoot, changelog), "utf8"),
        releaseCommits(changelog),
      ]);
      return markdown
        .split(/^## /mu)
        .slice(1)
        .flatMap((section): ChangelogTimelineEntry[] => {
          const version = section.slice(0, section.indexOf("\n")).trim();
          const content = notes(section.slice(section.indexOf("\n")));
          const commit = commits.get(version);
          if (!commit || !content) {
            return [];
          }
          const tag = `${name}@${version}`;
          return [
            {
              id: `${slug}-${version}`,
              title: `${label} ${version}`,
              date: commit.date,
              // The release workflow tags the release commit after the site's
              // build of it has started, so that build links it untagged.
              url:
                tagged.has(tag) || commit.hash === head.trim()
                  ? `${WEBSITE_CONFIG.GITHUB_URL}/releases/tag/${encodeURIComponent(tag)}`
                  : undefined,
              content,
            },
          ];
        });
    }),
  );
  return entries.flat();
}
