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
      {
        text: "Feedback",
        url: WEBSITE_CONFIG.FEEDBACK_URL,
        external: true,
      },
      {
        type: "button",
        text: "Get the app",
        url: "/#download",
      },
    ],
    githubUrl: WEBSITE_CONFIG.GITHUB_URL,
  };
}
