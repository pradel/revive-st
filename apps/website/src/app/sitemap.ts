import type { MetadataRoute } from "next";

/* eslint-disable no-undef */
import { source } from "@/lib/source";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) =>
    new URL(
      path,
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://revivest.app",
    ).toString();

  const docs = source.getPages().map((page) => ({
    url: url(page.url),
    lastModified: page.data.lastModified
      ? new Date(page.data.lastModified)
      : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: url("/"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...docs,
  ];
}
