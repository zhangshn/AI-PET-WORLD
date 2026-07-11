import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const outputPath = "data/live-world/visual-generation-dispatches/p10-active-chunks/p10-generated-candidate-contact-sheet.png";
const candidateRoot = "data/world-visual-candidates";
const tileWidth = 256;
const tileHeight = 214;

function candidateId(index) {
  return `p10-active-chunk-candidate-${String(index + 1).padStart(2, "0")}`;
}

function labelSvg(label) {
  return Buffer.from(`
    <svg width="${tileWidth}" height="22" xmlns="http://www.w3.org/2000/svg">
      <rect width="${tileWidth}" height="22" fill="#111111"/>
      <text x="8" y="15" font-size="13" fill="#ffffff" font-family="Arial, sans-serif">${label}</text>
    </svg>
  `);
}

await mkdir("data/live-world/visual-generation-dispatches/p10-active-chunks", { recursive: true });

const tiles = await Promise.all(
  Array.from({ length: 9 }, async (_, index) => {
    const id = candidateId(index);
    const input = `${candidateRoot}/${id}/output.image.png`;
    return sharp(input)
      .resize(256, 192)
      .extend({ top: 22, bottom: 0, left: 0, right: 0, background: "#111111" })
      .composite([{ input: labelSvg(id), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }),
);

await sharp({
  create: {
    width: tileWidth * 3,
    height: tileHeight * 3,
    channels: 3,
    background: "#222222",
  },
})
  .composite(tiles.map((input, index) => ({
    input,
    left: (index % 3) * tileWidth,
    top: Math.floor(index / 3) * tileHeight,
  })))
  .png()
  .toFile(outputPath);

console.log(`Wrote ${outputPath}`);
