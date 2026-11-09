import type { Metadata } from "next";

import { ChangelogTimeline } from "@/components/changelog";
import { Footer } from "@/components/footer";
import { releases } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog — Revive ST",
  description:
    "What's new in each release of the Revive ST app for Bose SoundTouch speakers and its server.",
  alternates: {
    canonical: "/changelog",
  },
};

export default async function ChangelogPage() {
  const entries = await releases();

  return (
    <div className="flex flex-col min-h-screen bg-bg text-fg selection:bg-accent-muted">
      <main className="flex-1 max-w-3xl mx-auto px-6 py-24 w-full">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
          Changelog
        </h1>
        <p className="text-lg text-fg-secondary text-pretty mb-12">
          What&apos;s new in each release of the Revive ST app and its server.
          Linked titles open the release on GitHub.
        </p>
        <ChangelogTimeline entries={entries} />
      </main>

      <Footer className="mt-auto" />
    </div>
  );
}
