import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ChangelogJumpMenu,
  ChangelogTimeline,
  ChangelogVersionList,
} from "@/components/changelog";
import { Footer } from "@/components/footer";
import { PRODUCTS, type ProductSlug, releases } from "@/lib/changelog";
import { cn } from "@/lib/cn";

export const dynamicParams = false;

/** The tabs: every product on `/changelog`, then one tab per product. */
const TABS: {
  product?: ProductSlug;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    label: "All",
    title: "Changelog — Revive ST",
    description:
      "What's new in each release of the Revive ST app for Bose SoundTouch speakers and its server.",
  },
  {
    product: "app",
    label: "App",
    title: "App changelog — Revive ST",
    description:
      "What's new in each release of the Revive ST app for Bose SoundTouch speakers.",
  },
  {
    product: "server",
    label: "Server",
    title: "Server changelog — Revive ST",
    description:
      "What's new in each release of the Revive ST server, which you can also host yourself.",
  },
];

function tabUrl(product?: ProductSlug): string {
  return product ? `/changelog/${product}` : "/changelog";
}

/** The tab of `/changelog/[[...product]]`, if there is one. */
async function tabOf(
  props: PageProps<"/changelog/[[...product]]">,
): Promise<(typeof TABS)[number] | undefined> {
  const { product = [] } = await props.params;
  if (product.length > 1) {
    return undefined;
  }
  return TABS.find((tab) => tab.product === product[0]);
}

export function generateStaticParams() {
  return [
    { product: [] },
    ...PRODUCTS.map(({ slug }) => ({ product: [slug] })),
  ];
}

export async function generateMetadata(
  props: PageProps<"/changelog/[[...product]]">,
): Promise<Metadata> {
  const tab = await tabOf(props);
  if (!tab) {
    notFound();
  }
  return {
    title: tab.title,
    description: tab.description,
    alternates: {
      canonical: tabUrl(tab.product),
    },
  };
}

export default async function ChangelogPage(
  props: PageProps<"/changelog/[[...product]]">,
) {
  const tab = await tabOf(props);
  if (!tab) {
    notFound();
  }
  const entries = await releases(tab.product);

  return (
    <div className="flex flex-col min-h-screen bg-bg text-fg selection:bg-accent-muted">
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-24 lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-16">
        <div className="min-w-0">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            Changelog
          </h1>
          <p className="text-lg text-fg-secondary text-pretty mb-8">
            What&apos;s new in each release of the Revive ST app and its server.
            Linked titles open the release on GitHub.
          </p>
          <nav
            aria-label="Products"
            className="mb-8 inline-flex rounded-full bg-surface-1 p-1 text-sm font-medium"
          >
            {TABS.map(({ product, label }) => (
              <Link
                key={label}
                href={tabUrl(product)}
                aria-current={product === tab.product ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 transition-colors",
                  product === tab.product
                    ? "bg-surface-3 text-fg"
                    : "text-fg-secondary hover:text-fg",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <ChangelogJumpMenu entries={entries} className="mb-8 lg:hidden" />
          <ChangelogTimeline entries={entries} />
        </div>
        <aside className="hidden lg:block">
          <ChangelogVersionList entries={entries} />
        </aside>
      </main>

      <Footer className="mt-auto" />
    </div>
  );
}
