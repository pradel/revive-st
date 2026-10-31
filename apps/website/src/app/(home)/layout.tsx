import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";

import { GitHubIcon } from "@/components/github-icon";
import { WEBSITE_CONFIG } from "@/config";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: LayoutProps<"/">) {
  const options = baseOptions();
  return (
    <HomeLayout
      {...options}
      // The GitHub icon is listed below so the download button can come last.
      githubUrl={undefined}
      links={[
        ...(options.links ?? []),
        {
          type: "icon",
          url: WEBSITE_CONFIG.GITHUB_URL,
          text: "GitHub",
          label: "GitHub",
          icon: <GitHubIcon />,
          external: true,
        },
        {
          type: "custom",
          secondary: true,
          children: (
            <Link
              href="/#download"
              className="inline-flex h-8 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Get the app
            </Link>
          ),
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
