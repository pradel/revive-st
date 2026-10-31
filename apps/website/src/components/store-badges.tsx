import Image from "next/image";

import { WEBSITE_CONFIG } from "@/config";

const BADGES = [
  {
    href: WEBSITE_CONFIG.IOS_APP_URL,
    src: "/button-ios-download.png",
    alt: "Download on the App Store",
  },
  {
    href: WEBSITE_CONFIG.ANDROID_APP_URL,
    src: "/button-android-download.png",
    alt: "Get it on Google Play",
  },
];

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {BADGES.map((badge) => (
        <a
          key={badge.href + badge.alt}
          href={badge.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Image src={badge.src} alt={badge.alt} width={135} height={45} />
        </a>
      ))}
    </div>
  );
}
