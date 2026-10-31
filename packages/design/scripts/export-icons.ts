// Builds every logo asset from brand/logo-mark.svg and the palette: the app
// icon, Android adaptive icon, splash image and favicons, plus the website's
// copies of the mark (dark and light accents) and the speaker drawings.
// Run with `vp run design#icons` after editing brand/*.svg, speakers/*.svg or
// the palette.
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { stdout } from "node:process";

import { Resvg } from "@resvg/resvg-js";

import { palette } from "../src/palette.ts";

const packageRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../", packageRoot);
const mark = await readFile(
  new URL("brand/logo-mark.svg", packageRoot),
  "utf8",
);

const viewBox = /^<svg [^>]*viewBox="([^"]+)"/mu.exec(mark)?.[1];
const artTag = /<g id="art"[^>]* stroke="(#[0-9A-Fa-f]{6})"[^>]*>/u.exec(
  mark,
)?.[0];
if (!viewBox || !artTag || !mark.includes('<g id="level-bars"')) {
  throw new Error(
    "brand/logo-mark.svg no longer has the structure this script expects",
  );
}
const [, , markWidth, markHeight] = viewBox.split(" ").map(Number);
const art: string = artTag;

/** The mark drawn in `colour`. */
function coloured(colour: string): string {
  return mark.replace(
    art,
    art.replace(/stroke="#[0-9A-Fa-f]{6}"/u, `stroke="${colour}"`),
  );
}

/** The mark, `width` wide, centred on a 1024 square, over `background` if given. */
function onSquare(
  svg: string,
  { width, background }: { width: number; background?: string },
): string {
  const size = 1024;
  const height = (width * markHeight) / markWidth;
  const placed = svg.replace(
    /^<svg [^>]*>/mu,
    `<svg x="${(size - width) / 2}" y="${(size - height) / 2}" width="${width}" height="${height}" viewBox="${viewBox}">`,
  );
  const fill = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${fill}${placed}</svg>`;
}

// Favicons: the level bars are lost at 48 px, so only the S and T, filling
// 62 % of the square. ST_BOX is their outline, strokes included.
const ST_BOX = { left: 390, top: 320, width: 276, height: 269.5 };
const side = ST_BOX.width / 0.62;
const left = ST_BOX.left + ST_BOX.width / 2 - side / 2;
const top = ST_BOX.top + ST_BOX.height / 2 - side / 2;
const monogram = coloured(palette.dark.accent)
  .replace('<g id="level-bars"', '<g id="level-bars" display="none"')
  .replace(
    /^<svg [^>]*>/mu,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${side} ${side}">`,
  )
  .replace(
    /^(\s*)<g id="art"/mu,
    `$1<rect x="${left}" y="${top}" width="${side}" height="${side}" fill="${palette.dark.bg}"/>$1<g id="art"`,
  );

const outputs = [
  {
    // iOS and Expo app icon: the store and the OS round the corners.
    svg: onSquare(coloured(palette.dark.accent), {
      width: 650,
      background: palette.dark.bg,
    }),
    width: 1024,
    files: ["apps/app/assets/images/icon.png"],
  },
  {
    // Android adaptive icon foreground: inside the 66 % safe zone, on the
    // background colour set in app.json.
    svg: onSquare(coloured(palette.dark.accent), { width: 560 }),
    width: 1024,
    files: ["apps/app/assets/images/adaptive-icon.png"],
  },
  {
    // Splash image, on the splash background colour set in app.json.
    svg: coloured(palette.dark.accent),
    width: 1024,
    files: ["apps/app/assets/images/splash-icon.png"],
  },
  {
    svg: monogram,
    width: 48,
    files: [
      "apps/app/assets/images/favicon.png",
      "apps/website/src/app/icon.png",
    ],
  },
];

for (const { svg, width, files } of outputs) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } })
    .render()
    .asPng();
  for (const file of files) {
    await writeFile(new URL(file, repoRoot), png);
    stdout.write(`${file} (${width} px wide)\n`);
  }
}

const markCopies = [
  { file: "apps/website/public/logo-mark.svg", colour: palette.dark.accent },
  {
    file: "apps/website/public/logo-mark-light.svg",
    colour: palette.light.accent,
  },
];
for (const { file, colour } of markCopies) {
  await writeFile(new URL(file, repoRoot), coloured(colour));
  stdout.write(`${file}\n`);
}

const speakersDir = new URL("speakers/", packageRoot);
const speakersCopy = new URL("apps/website/public/speakers/", repoRoot);
await mkdir(speakersCopy, { recursive: true });
for (const file of await readdir(speakersDir)) {
  await copyFile(new URL(file, speakersDir), new URL(file, speakersCopy));
  stdout.write(`apps/website/public/speakers/${file}\n`);
}
