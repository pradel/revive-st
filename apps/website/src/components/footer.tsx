import Link from "next/link";

import { WEBSITE_CONFIG } from "@/config";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={`py-8 px-6 border-t border-neutral-200 bg-white flex flex-col md:flex-row items-center justify-between text-xs text-neutral-500 gap-4 ${className ?? ""}`}
    >
      <div className="font-bold text-neutral-900 text-sm">Revive ST</div>
      <p>
        &copy; {new Date().getFullYear()} Revive ST. Not affiliated with Bose
        Corporation. Bose and SoundTouch are trademarks of Bose Corporation.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/privacy"
          className="hover:text-neutral-900 transition-colors"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="hover:text-neutral-900 transition-colors"
        >
          Terms of Service
        </Link>
        <a
          href={WEBSITE_CONFIG.GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-neutral-900 transition-colors"
        >
          GitHub Repository
        </a>
      </div>
    </footer>
  );
}
