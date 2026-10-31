import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { GitHubIcon } from "@/components/github-icon";
import { WEBSITE_CONFIG } from "@/config";

const currentYear = new Date().getFullYear();

const COLUMNS: {
  title: string;
  links: { text: string; href: string; external?: boolean }[];
}[] = [
  {
    title: "Product",
    links: [
      { text: "Get the app", href: "/#download" },
      { text: "Features", href: "/#features" },
      { text: "Pricing", href: "/#pricing" },
      { text: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Resources",
    links: [
      { text: "Documentation", href: "/docs" },
      { text: "Supported speakers", href: "/docs/supported-speakers" },
      { text: "Self-hosting", href: "/docs/self-hosting" },
      { text: "Contributing", href: "/docs/developers/contributing" },
    ],
  },
  {
    title: "Community",
    links: [
      { text: "GitHub", href: WEBSITE_CONFIG.GITHUB_URL, external: true },
      {
        text: "Discussions",
        href: WEBSITE_CONFIG.FEEDBACK_URL,
        external: true,
      },
      { text: "Sponsor", href: WEBSITE_CONFIG.SPONSOR_URL, external: true },
      { text: "Contact", href: `mailto:${WEBSITE_CONFIG.CONTACT_EMAIL}` },
    ],
  },
];

const LINK = "text-fg-secondary transition-colors hover:text-fg";
const ICON_BUTTON =
  "flex size-9 items-center justify-center rounded-full bg-surface-1 text-fg-secondary transition-colors hover:bg-surface-2 hover:text-fg";

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={`px-4 pt-16 pb-10 text-sm ${className ?? ""}`}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo-mark.svg"
                width={538}
                height={312}
                alt=""
                className="h-7 w-auto"
              />
              <span className="text-base font-bold text-fg">Revive ST</span>
            </Link>
            <p className="mt-4 max-w-xs text-fg-secondary text-pretty">
              The open-source app that brings Bose SoundTouch speakers back to
              life.
            </p>
            <div className="mt-6 flex gap-2">
              <a
                href={WEBSITE_CONFIG.GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Revive ST on GitHub"
                className={ICON_BUTTON}
              >
                <GitHubIcon className="size-4" />
              </a>
              <a
                href={WEBSITE_CONFIG.SPONSOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Sponsor Revive ST"
                className={ICON_BUTTON}
              >
                <Heart className="size-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-4 font-semibold text-fg">{column.title}</h2>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.text}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK}
                      >
                        {link.text}
                      </a>
                    ) : (
                      <Link href={link.href} className={LINK}>
                        {link.text}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-separator pt-6 text-xs text-fg-tertiary md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {currentYear} Revive ST · MIT licensed. Not affiliated with
            Bose Corporation. Bose and SoundTouch are trademarks of Bose
            Corporation.
          </p>
          <div className="flex shrink-0 gap-5">
            <Link href="/privacy" className="transition-colors hover:text-fg">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-fg">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
