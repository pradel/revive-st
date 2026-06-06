import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";

// eslint-disable-next-line no-undef
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Revive ST — SoundTouch Controller App for iPhone and Android",
  description:
    "The SoundTouch app was shut down in May 2026. Revive ST is the free, open-source replacement that brings back preset buttons, internet radio, and multi-room control. One purchase, no subscription, no account needed.",
};

import "./global.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ options: { type: "static" } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
