// 该文件为树木 SVG 预览增加体积实验层。

import type { PixelTreeRenderTestResult, PixelTreeWorldFact } from "./tree-render-test-module";

export function addTreeVolumePreviewLayer(svg: string, test: PixelTreeRenderTestResult): string {
  const volumeSvg = buildVolumeSvg(test);
  return svg.replace("</svg>", `${volumeSvg}\n</svg>`);
}

function buildVolumeSvg(test: PixelTreeRenderTestResult): string {
  const palette = getVolumePalette(test.fact.biome);
  const random = createSeededRandom(`${test.fact.worldSeed}:${test.fact.id}:tree-volume-v2`);
  const baseX = Math.round(test.structure.anchor.x + test.structure.trunk.lean);
  const baseY = Math.round(test.structure.anchor.y);
  const crownY = Math.round(baseY - test.decision.trunkHeight - test.decision.crownHeight * 0.12);
  const crownWidth = Math.max(24, Math.round(test.decision.crownWidth));
  const crownHeight = Math.max(20, Math.round(test.decision.crownHeight));
  const parts: string[] = [];

  parts.push(buildTrunkSideSvg(test, palette));

  for (let index = 0; index < 14; index += 1) {
    const x = baseX + Math.round((random() - 0.16) * crownWidth * 0.78);
    const y = crownY + Math.round((0.08 + random() * 0.42) * crownHeight);
    const width = random() > 0.62 ? 8 : 5;
    const height = random() > 0.7 ? 5 : 3;

    parts.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${palette.underShade}" opacity="0.22"/>`,
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const x = baseX - Math.round(crownWidth * 0.38) + Math.round(random() * crownWidth * 0.42);
    const y = crownY - Math.round(crownHeight * 0.28) + Math.round(random() * crownHeight * 0.24);
    const size = random() > 0.68 ? 6 : 4;

    parts.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${palette.topLight}" opacity="0.3"/>`,
    );
  }

  return `<g opacity="1">${parts.join("\n")}</g>`;
}

function buildTrunkSideSvg(test: PixelTreeRenderTestResult, palette: ReturnType<typeof getVolumePalette>): string {
  const sideWidth = Math.max(2, Math.round(test.structure.trunk.width * 0.16));
  const sideHeight = Math.max(8, Math.round(test.structure.trunk.height * 0.66));
  const x = Math.round(test.structure.trunk.x + test.structure.trunk.lean - 1);
  const y = Math.round(test.structure.trunk.y + test.structure.trunk.height * 0.18);

  return `<rect x="${x}" y="${y}" width="${sideWidth}" height="${sideHeight}" fill="${palette.trunkSide}" opacity="0.2"/>`;
}

function getVolumePalette(biome: PixelTreeWorldFact["biome"]): {
  underShade: string;
  topLight: string;
  trunkSide: string;
} {
  if (biome === "desert") {
    return { underShade: "#4f552f", topLight: "#d1cf75", trunkSide: "#4a321b" };
  }

  if (biome === "oasis") {
    return { underShade: "#1c634e", topLight: "#a5e3b5", trunkSide: "#4e321f" };
  }

  if (biome === "forest") {
    return { underShade: "#154526", topLight: "#91d66a", trunkSide: "#3f2416" };
  }

  return { underShade: "#286333", topLight: "#b5e37b", trunkSide: "#4c2f18" };
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed);

  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
