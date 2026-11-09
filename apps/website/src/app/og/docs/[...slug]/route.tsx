import { palette } from "@revive-st/design";
import { generate as DefaultImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { inter, svgDataUrl } from "@/lib/og";
import { appName } from "@/lib/shared";
import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/docs/[...slug]">,
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  const [logo, regular, semiBold, extraBold] = await Promise.all([
    svgDataUrl("logo-mark.svg"),
    inter(400),
    inter(600),
    inter(800),
  ]);

  return new ImageResponse(
    <DefaultImage
      title={<span style={{ letterSpacing: -2.5 }}>{page.data.title}</span>}
      description={page.data.description}
      site={appName}
      // The mark at the height of the site name's text (56 px).
      icon={<img src={logo} width={101} height={56} alt="" />}
      // The dashed rule and the bottom band: a surface step, like the site's
      // structure, so the accent stays on the logo and the site name.
      primaryColor={palette.dark.surface2}
      primaryTextColor={palette.dark.accent}
    />,
    {
      width: 1200,
      height: 630,
      // Description, site name and title, in the weights DefaultImage uses.
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: semiBold, weight: 600, style: "normal" },
        { name: "Inter", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
