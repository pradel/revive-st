/* eslint-disable no-undef */
"use client";

import { load, trackPageview, trackEvent } from "fathom-client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function TrackPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fathomId = process.env.NEXT_PUBLIC_FATHOM_ID;
    if (!fathomId) {
      return;
    }

    // Only load Fathom in production to avoid polluting stats
    if (process.env.NODE_ENV === "production") {
      load(fathomId, {
        auto: false, // Handle pageviews manually to support Next.js client-side routing
      });
    }

    // Set up global click listener for tracking CTA/GitHub/Get Started events
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const element = target.closest("a, button");
      if (!element) {
        return;
      }

      const href = element.getAttribute("href") ?? "";
      const text = (element.textContent ?? "").trim().toLowerCase();

      // Only track in production to prevent cluttering Fathom dashboard
      const shouldTrack = process.env.NODE_ENV === "production";
      const logOrTrack = (name: string) => {
        if (shouldTrack) {
          trackEvent(name);
        } else {
          // eslint-disable-next-line no-console
          console.log(`[Fathom Event Dev-Log]: Track event "${name}"`);
        }
      };

      // 1. Track "Download" CTA clicks
      if (
        text.includes("download") ||
        text.includes("app store") ||
        text.includes("google play") ||
        href.includes("#download") ||
        href.includes("#download-ios") ||
        href.includes("#download-android") ||
        href.includes("apple.com") ||
        href.includes("play.google.com")
      ) {
        logOrTrack("Download");
        return;
      }

      // 2. Track "Get Started" clicks
      if (
        text.includes("get started") ||
        text.includes("getting started") ||
        href === "/docs" ||
        href.startsWith("/docs/")
      ) {
        logOrTrack("Get Started");
        return;
      }

      // 3. Track GitHub clicks
      if (href.includes("github.com")) {
        logOrTrack("GitHub Click");
      }
    };

    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    const fathomId = process.env.NEXT_PUBLIC_FATHOM_ID;
    if (!fathomId) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      const url =
        pathname +
        (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      // eslint-disable-next-line no-console
      console.log(`[Fathom Pageview Dev-Log]: Track pageview ${url}`);
      return;
    }
    if (!pathname) {
      return;
    }

    trackPageview({
      url:
        pathname +
        (searchParams?.toString() ? `?${searchParams.toString()}` : ""),
      referrer: document.referrer,
    });
  }, [pathname, searchParams]);

  return null;
}

export function FathomAnalytics() {
  return (
    <Suspense fallback={null}>
      <TrackPageView />
    </Suspense>
  );
}
