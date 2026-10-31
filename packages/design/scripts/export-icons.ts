// Regenerates the app and website icons from the vector sources in brand/, and
// copies the mark and the speaker drawings (speakers/) into the website.
// Run with `vp run design#icons` after editing brand/*.svg or speakers/*.svg.
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { stdout } from "node:process";

import { Resvg } from "@resvg/resvg-js";

const packageRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../", packageRoot);
const logo = await readFile(new URL("brand/logo.svg", packageRoot), "utf8");
const mark = await readFile(
  new URL("brand/logo-mark.svg", packageRoot),
  "utf8",
);

const background =
  /<rect width="1024" height="1024" fill="(#[0-9A-Fa-f]{6})"/u.exec(logo)?.[1];
const markDefs = /<defs>[\s\S]*<\/defs>/u.exec(mark)?.[0];
const markColor = /<rect id="art"[^>]* fill="(#[0-9A-Fa-f]{6})"/u.exec(
  mark,
)?.[1];
if (!background || !markDefs || !markColor) {
  throw new Error(
    "brand/*.svg no longer has the structure this script expects",
  );
}

// Favicons: only the S and T, centred on the logo background and filling ~56 %
// of the square like the previous ones. The 9 px neon lines vanish at 48 px, so
// the tubes are filled solid with a dark centre line instead.
const ST_BOX = { left: 385.5, top: 315.5, width: 281.5, height: 278.5 };
const ST_FILL = 0.56;
const side = ST_BOX.width / ST_FILL;
const left = ST_BOX.left + ST_BOX.width / 2 - side / 2;
const top = ST_BOX.top + ST_BOX.height / 2 - side / 2;
const monogram = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${side} ${side}">
  ${markDefs}
  <mask id="monogram" maskUnits="userSpaceOnUse" x="${left}" y="${top}" width="${side}" height="${side}">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <use href="#tube-st" stroke="#fff" stroke-width="49"/>
      <path d="M586 384H652.5" stroke="#fff" stroke-width="29"/>
      <use href="#tube-st" stroke="#000" stroke-width="13"/>
    </g>
  </mask>
  <rect x="${left}" y="${top}" width="${side}" height="${side}" fill="${background}"/>
  <rect x="${left}" y="${top}" width="${side}" height="${side}" fill="${markColor}" mask="url(#monogram)"/>
</svg>`;

const outputs = [
  {
    svg: logo,
    size: 1024,
    files: [
      "apps/app/assets/images/icon.png",
      "apps/app/assets/images/splash-icon.png",
    ],
  },
  {
    svg: monogram,
    size: 48,
    files: [
      "apps/app/assets/images/favicon.png",
      "apps/website/src/app/icon.png",
    ],
  },
];

for (const { svg, size, files } of outputs) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  for (const file of files) {
    await writeFile(new URL(file, repoRoot), png);
    stdout.write(`${file} (${size}×${size})\n`);
  }
}

const markCopy = "apps/website/public/logo-mark.svg";
await writeFile(new URL(markCopy, repoRoot), mark);
stdout.write(`${markCopy}\n`);

const speakersDir = new URL("speakers/", packageRoot);
const speakersCopy = new URL("apps/website/public/speakers/", repoRoot);
await mkdir(speakersCopy, { recursive: true });
for (const file of await readdir(speakersDir)) {
  await copyFile(new URL(file, speakersDir), new URL(file, speakersCopy));
  stdout.write(`apps/website/public/speakers/${file}\n`);
}
