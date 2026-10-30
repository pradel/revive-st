import Link from "next/link";

import { WEBSITE_CONFIG } from "@/config";

const currentYear = new Date().getFullYear();

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={`py-8 px-6 border-t border-separator bg-surface-1 flex flex-col md:flex-row items-center justify-between text-xs text-fg-tertiary gap-4 ${className ?? ""}`}
    >
      <div className="font-bold text-fg text-sm">Revive ST</div>
      <p>
        &copy; {currentYear} Revive ST. Not affiliated with Bose Corporation.
        Bose and SoundTouch are trademarks of Bose Corporation.
      </p>
      <div className="flex items-center gap-4">
        <Link href="/privacy" className="hover:text-fg transition-colors">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-fg transition-colors">
          Terms of Service
        </Link>
        <a
          href={WEBSITE_CONFIG.GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg transition-colors"
        >
          GitHub Repository
        </a>
        <a
          href={WEBSITE_CONFIG.FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg transition-colors"
        >
          Feedback
        </a>
        <a
          href={WEBSITE_CONFIG.SPONSOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg transition-colors"
        >
          Sponsor
        </a>
      </div>
    </footer>
  );
}
