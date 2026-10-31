import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { LogoMark } from "@/components/logo-mark";
import { WEBSITE_CONFIG } from "@/config";

import { appName } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <LogoMark className="h-5" />
          {appName}
        </>
      ),
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
      {
        text: "Feedback",
        url: WEBSITE_CONFIG.FEEDBACK_URL,
        external: true,
      },
    ],
    githubUrl: WEBSITE_CONFIG.GITHUB_URL,
  };
}
