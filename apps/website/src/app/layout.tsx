import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";

// eslint-disable-next-line no-undef
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Revive ST — SoundTouch Controller App",
  description:
    "The open-source replacement app for Bose SoundTouch speakers. Bring back full control to your hardware today. No subscription, no account needed.",
};

import "./global.css";
import { Inter } from "next/font/google";

import { FathomAnalytics } from "@/components/fathom";

const inter = Inter({
  subsets: ["latin"],
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          // oxlint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Revive ST",
              url: siteUrl,
              potentialAction: {
                "@type": "SearchAction",
                target: `${siteUrl}/api/search?query={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <FathomAnalytics />
        <RootProvider search={{ options: { type: "static" } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
