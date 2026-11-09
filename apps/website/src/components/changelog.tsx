import { createMarkdownRenderer } from "fumadocs-core/content/md";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import type { TOCItemType } from "fumadocs-core/toc";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { TOCProvider, TOCScrollArea } from "fumadocs-ui/components/toc";
import { TOCItem, TOCItems } from "fumadocs-ui/components/toc/default";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Suspense } from "react";

import { CopyAnchorLink } from "./copy-anchor-link";

export interface ChangelogTimelineEntry {
  /** unique, and the entry's anchor, e.g. `app-0.0.5` */
  id: string;
  title: string;
  date: Date;
  /** URL of the entry, e.g. a GitHub release */
  url?: string;
  /** content in Markdown */
  content?: string;
}

const { Markdown } = createMarkdownRenderer({
  remarkPlugins: [remarkGfm],
  // `tab` wraps code blocks in MDX elements, which Markdown can't render
  rehypePlugins: [[rehypeCode, { fallbackLanguage: "plaintext", tab: false }]],
});

const mdxComponents = {
  ...defaultMdxComponents,
  img: "img" as const,
};

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

interface Month {
  /** anchor, like `2026-11` */
  id: string;
  title: string;
  entries: ChangelogTimelineEntry[];
}

/** The entries by month, newest first. */
function byMonth(entries: ChangelogTimelineEntry[]): Month[] {
  const months = new Map<string, Month>();
  for (const entry of [...entries].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  )) {
    const id = entry.date.toISOString().slice(0, 7);
    const month = months.get(id);
    if (month) {
      month.entries.push(entry);
    } else {
      months.set(id, {
        id,
        title: monthFormat.format(entry.date),
        entries: [entry],
      });
    }
  }
  return [...months.values()];
}

export function ChangelogTimeline({
  entries,
}: {
  entries: ChangelogTimelineEntry[];
}) {
  return (
    <div className="flex flex-col gap-8">
      {byMonth(entries).map((month) => (
        <section key={month.id} id={month.id} className="scroll-mt-28">
          <h2 className="sticky top-14 z-1 bg-fd-background/80 py-4 text-sm font-medium text-fd-muted-foreground backdrop-blur-sm">
            {month.title}
          </h2>
          <ol className="ms-3 border-s ps-6">
            {month.entries.map((entry) => (
              <ChangelogItem key={entry.id} entry={entry} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ChangelogItem({ entry }: { entry: ChangelogTimelineEntry }) {
  return (
    <li id={entry.id} className="group scroll-mt-28 pb-10 last:pb-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <time
          dateTime={entry.date.toISOString()}
          className="relative pe-2 text-xs font-medium text-fd-primary tabular-nums"
        >
          <span className="absolute -start-6 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fd-primary rtl:translate-x-1/2" />
          {dayFormat.format(entry.date)}
        </time>
      </div>
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        {entry.url ? (
          <a href={entry.url} className="hover:text-fd-primary">
            {entry.title}
          </a>
        ) : (
          entry.title
        )}
        <CopyAnchorLink
          id={entry.id}
          label={`Copy the link to ${entry.title}`}
        />
      </h3>
      <div className="prose prose-sm text-fd-muted-foreground">
        {entry.content && (
          <Suspense>
            <Markdown async components={mdxComponents}>
              {entry.content}
            </Markdown>
          </Suspense>
        )}
      </div>
    </li>
  );
}

/** Months, and their versions under them. */
function tocItems(entries: ChangelogTimelineEntry[]): TOCItemType[] {
  return byMonth(entries).flatMap((month) => [
    { title: month.title, url: `#${month.id}`, depth: 2 },
    ...month.entries.map((entry) => ({
      title: entry.title,
      url: `#${entry.id}`,
      depth: 3,
    })),
  ]);
}

/** Every version in a "Jump to version" menu, for screens too narrow for the list beside the timeline. */
export function ChangelogJumpMenu({
  entries,
  className,
}: {
  entries: ChangelogTimelineEntry[];
  className?: string;
}) {
  return (
    <InlineTOC items={tocItems(entries)} className={className}>
      Jump to version
    </InlineTOC>
  );
}

/** Every version, beside the timeline, highlighting the ones in view. */
export function ChangelogVersionList({
  entries,
}: {
  entries: ChangelogTimelineEntry[];
}) {
  const items = tocItems(entries);

  return (
    <nav
      aria-label="Versions"
      className="sticky top-24 flex max-h-[calc(100dvh-8rem)] flex-col"
    >
      <p className="mb-1 text-sm font-medium">Versions</p>
      <TOCProvider toc={items}>
        <TOCScrollArea>
          <TOCItems>
            {items.map((item) => (
              <TOCItem key={item.url} item={item} />
            ))}
          </TOCItems>
        </TOCScrollArea>
      </TOCProvider>
    </nav>
  );
}
