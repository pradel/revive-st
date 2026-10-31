"use client";

import { useEffect, useState } from "react";

/**
 * Mobile-only download bar, shown once the hero (`#hero`) has scrolled away
 * and hidden again while the download section (`#download`) or the footer is
 * on screen.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const download = document.getElementById("download");
    if (!hero || !download) {
      return;
    }
    const hiders = [hero, download, document.querySelector("footer")].filter(
      (element) => element !== null,
    );
    const onScreen = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        onScreen.set(entry.target, entry.isIntersecting);
      }
      setVisible(!hiders.some((element) => onScreen.get(element)));
    });
    for (const element of hiders) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      inert={!visible}
      className={`fixed inset-x-3 bottom-3 z-40 md:hidden transition duration-300 motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0"
      }`}
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-1/90 p-2 pl-4 shadow-phone ring-1 ring-separator backdrop-blur-xl">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">Revive ST</p>
          <p className="truncate text-xs text-fg-tertiary">
            One-time purchase · Open source
          </p>
        </div>
        <a
          href="#download"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent"
        >
          Get the app
        </a>
      </div>
    </div>
  );
}
