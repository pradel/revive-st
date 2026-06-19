import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { WEBSITE_CONFIG } from "@/config";

import { appName } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: appName,
    },
    links: [
      {
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
    ],
    githubUrl: WEBSITE_CONFIG.GITHUB_URL,
  };
}
