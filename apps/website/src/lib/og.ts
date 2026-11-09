import { readFile } from "node:fs/promises";
import { join } from "node:path";

// eslint-disable-next-line no-undef
const root = process.cwd();

/** A file under `public/` as a data URL, for `<img>` in share images. */
export async function svgDataUrl(file: string): Promise<string> {
  const svg = await readFile(join(root, "public", file));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/**
 * Inter from @fontsource, for share images: Satori reads WOFF, not the WOFF2
 * next/font serves.
 */
export async function inter(weight: 400 | 500 | 600 | 700 | 800) {
  return readFile(
    join(
      root,
      `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff`,
    ),
  );
}
