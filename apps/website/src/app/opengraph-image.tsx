import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { palette } from "@revive-st/design";
import { ImageResponse } from "next/og";

/**
 * The image shown when a page of the site is shared, rendered at build time.
 * Docs pages replace it with their own (`/og/docs/…`).
 */
export const alt =
  "Revive ST: your Bose SoundTouch speakers still work, now your app does too.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

const { dark } = palette;

// eslint-disable-next-line no-undef
const root = process.cwd();

/** A file under `public/` as a data URL, for `<img>`. */
async function svgDataUrl(file: string): Promise<string> {
  const svg = await readFile(join(root, "public", file));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** Inter from @fontsource: Satori reads WOFF, not the WOFF2 next/font serves. */
async function inter(weight: 500 | 700) {
  return readFile(
    join(
      root,
      `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`,
    ),
  );
}

/**
 * The speakers in a row, drawn to scale: the drawings are 10 units per inch,
 * so one factor keeps their real sizes.
 */
const SPEAKER_SCALE = 1.3;
const SPEAKERS = [
  { file: "soundtouch-10.svg", width: 56, height: 88 },
  { file: "soundtouch-30.svg", width: 171, height: 102 },
  { file: "soundtouch-20.svg", width: 124, height: 78 },
  { file: "soundtouch-portable.svg", width: 96, height: 66 },
];

export default async function Image() {
  const [logo, speakers, medium, bold] = await Promise.all([
    svgDataUrl("logo-mark.svg"),
    Promise.all(
      SPEAKERS.map(async (speaker) => ({
        ...speaker,
        src: await svgDataUrl(`speakers/${speaker.file}`),
      })),
    ),
    inter(500),
    inter(700),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        backgroundColor: dark.bg,
        backgroundImage: `radial-gradient(ellipse 80% 70% at 50% 0%, ${dark.accentMuted}, transparent)`,
        color: dark.textPrimary,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img src={logo} width={87} height={48} alt="" />
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
          Revive ST
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 56,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: -2.5,
        }}
      >
        <div>Your Bose speakers still work.</div>
        <div style={{ color: dark.accent }}>Now your app does too.</div>
      </div>

      <div
        style={{
          marginTop: 28,
          fontSize: 28,
          fontWeight: 500,
          color: dark.textSecondary,
        }}
      >
        Open-source SoundTouch app for iPhone and Android.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          gap: 16,
          marginTop: "auto",
        }}
      >
        {speakers.map((speaker) => (
          <img
            key={speaker.file}
            src={speaker.src}
            width={speaker.width * SPEAKER_SCALE}
            height={speaker.height * SPEAKER_SCALE}
            alt=""
          />
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Inter", data: medium, weight: 500, style: "normal" },
        { name: "Inter", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
