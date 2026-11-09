"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A link to `#id` that also copies the page's URL with it. With a mouse it
 * shows on hover of the closest `group`; touch screens always show it.
 */
export function CopyAnchorLink({ id, label }: { id: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const Icon = copied ? Check : LinkIcon;
  return (
    <a
      href={`#${id}`}
      aria-label={label}
      title={copied ? "Link copied" : "Copy link"}
      onClick={() => {
        void navigator.clipboard
          .writeText(new URL(`#${id}`, location.href).href)
          .then(() => {
            setCopied(true);
          });
      }}
      className="text-fd-muted-foreground transition-opacity hover:text-fd-primary pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-[copied=true]:opacity-100"
      data-copied={copied}
    >
      <Icon className="size-4" />
    </a>
  );
}
