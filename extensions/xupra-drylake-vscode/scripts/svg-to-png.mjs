import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mediaDir = join(__dirname, "..", "media");

const targets = [
  { svg: "readme-kanban.svg", png: "readme-kanban.png", width: 1400 },
  { svg: "readme-kanban.svg", png: "readme-kanban-v2.png", width: 1400 },
  { svg: "readme-pipeline.svg", png: "readme-pipeline.png", width: 1400 },
  { svg: "readme-pipeline.svg", png: "readme-pipeline-v2.png", width: 1400 },
];

for (const t of targets) {
  const svgPath = join(mediaDir, t.svg);
  const pngPath = join(mediaDir, t.png);
  const svg = readFileSync(svgPath);
  await sharp(svg, { density: 144 })
    .resize({ width: t.width })
    .png({ compressionLevel: 9 })
    .toFile(pngPath);
  console.log(`Wrote ${t.png}`);
}
