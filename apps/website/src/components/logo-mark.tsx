import Image from "next/image";

import { cn } from "@/lib/cn";

/**
 * The Revive ST mark in the theme's accent: `vp run design#icons` writes both
 * copies from packages/design/brand/logo-mark.svg.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/logo-mark-light.svg"
        width={524}
        height={290}
        alt=""
        className={cn("block w-auto dark:hidden", className)}
      />
      <Image
        src="/logo-mark.svg"
        width={524}
        height={290}
        alt=""
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
