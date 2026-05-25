// 该文件为树木 SVG 预览增加体积实验层。

import type {
  PixelTreeBranchPlan,
  PixelTreeRenderTestResult,
  PixelTreeWorldFact,
} from "./tree-render-test-module";

export function addTreeVolumePreviewLayer(svg: string, test: PixelTreeRenderTestResult): string {
  const label = extractDebugLabel(svg) ?? `${test.fact.biome} g${test.fact.growth} h${test.fact.health} m${test.fact.moisture}`;
  return buildVolumePrototypeSvg(test, label);
}

function buildVolumePrototypeSvg(test: PixelTreeRenderTestResult, label: string): string {
  const palette = getVolumePalette(test.fact.biome);
  const baseX = Math.round(test.structure.anchor.x + test.structure.trunk.lean);
  const baseY = Math.round(test.structure.anchor.y);
  const crownY = Math.round(baseY - test.decision.trunkHeight - test.decision.crownHeight * 0.16);
  const crownWidth = Math.max(64, Math.round(test.decision.crownWidth * 0.86));
  const crownHeight = Math.max(48, Math.round(test.decision.crownHeight * 0.78));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" shape-rendering="crispEdges" role="img" aria-label="procedural volume tree preview">`,
    `<rect x="0" y="0" width="320" height="320" fill="#17231f"/>`,
    `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeSvgText(label)}</text>`,
    buildGroundSvg(test, palette, baseX, baseY),
    buildTrunkSvg(test, palette),
    buildBranchSvg(test.structure.branches, palette),
    buildCrownSvg(test, palette, baseX, crownY, crownWidth, crownHeight),
    buildForegroundGroundSvg(test, palette, baseX, baseY),
    `</svg>`,
  ].join("\n");
}

function buildGroundSvg(
  test: PixelTreeRenderTestResult,
  palette: ReturnType<typeof getVolumePalette>,
  baseX: number,
  baseY: number,
): string {
  const baseWidth = Math.max(34, Math.round(test.decision.trunkWidth * 2.6));

  return [
    `<ellipse cx="160" cy="266" rx="108" ry="26" fill="#263f2f" opacity="0.82"/>`,
    `<ellipse cx="${baseX + 9}" cy="${baseY + 12}" rx="${Math.round(test.decision.crownWidth * 0.38)}" ry="${Math.round(
      test.decision.crownHeight * 0.1,
    )}" fill="#08120f" opacity="0.18"/>`,
    `<ellipse cx="${baseX}" cy="${baseY + 8}" rx="${Math.round(baseWidth * 1.35)}" ry="13" fill="${palette.soil}" opacity="0.48"/>`,
    `<ellipse cx="${baseX + 2}" cy="${baseY + 10}" rx="${Math.round(baseWidth * 0.72)}" ry="5" fill="${palette.groundDark}" opacity="0.46"/>`,
  ].join("\n");
}

function buildTrunkSvg(test: PixelTreeRenderTestResult, palette: ReturnType<typeof getVolumePalette>): string {
  const trunkX = Math.round(test.structure.trunk.x + test.structure.trunk.lean);
  const trunkY = Math.round(test.structure.trunk.y);
  const trunkWidth = Math.round(test.structure.trunk.width);
  const trunkHeight = Math.round(test.structure.trunk.height);
  const coreWidth = Math.max(4, Math.round(trunkWidth * 0.52));
  const lightWidth = Math.max(2, Math.round(trunkWidth * 0.16));

  return [
    `<rect x="${trunkX}" y="${trunkY}" width="${trunkWidth}" height="${trunkHeight}" fill="${palette.trunkDark}"/>`,
    `<rect x="${trunkX + Math.round(trunkWidth * 0.22)}" y="${trunkY + 2}" width="${coreWidth}" height="${trunkHeight - 4}" fill="${palette.trunkMain}"/>`,
    `<rect x="${trunkX + Math.round(trunkWidth * 0.66)}" y="${trunkY + 6}" width="${lightWidth}" height="${Math.round(
      trunkHeight * 0.58,
    )}" fill="${palette.trunkLight}" opacity="0.78"/>`,
    `<rect x="${trunkX - 1}" y="${trunkY + Math.round(trunkHeight * 0.18)}" width="${Math.max(2, Math.round(
      trunkWidth * 0.16,
    ))}" height="${Math.round(trunkHeight * 0.68)}" fill="${palette.trunkSide}" opacity="0.38"/>`,
  ].join("\n");
}

function buildBranchSvg(branches: PixelTreeBranchPlan[], palette: ReturnType<typeof getVolumePalette>): string {
  return branches
    .slice(0, 5)
    .map(
      (branch) =>
        `<line x1="${Math.round(branch.startX)}" y1="${Math.round(branch.startY)}" x2="${Math.round(branch.endX)}" y2="${Math.round(
          branch.endY,
        )}" stroke="${palette.branch}" stroke-width="${Math.max(1, Math.round(branch.width))}" stroke-linecap="square" opacity="0.72"/>`,
    )
    .join("\n");
}

function buildCrownSvg(
  test: PixelTreeRenderTestResult,
  palette: ReturnType<typeof getVolumePalette>,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): string {
  const random = createSeededRandom(`${test.fact.worldSeed}:${test.fact.id}:volume-prototype-crown`);
  const leafBits: string[] = [];

  for (let index = 0; index < 36; index += 1) {
    const x = centerX + Math.round((random() - 0.5) * width * 1.02);
    const y = centerY + Math.round((random() - 0.48) * height * 0.78);
    const size = random() > 0.72 ? 6 : 4;
    const tone = random();
    const color = tone > 0.76 ? palette.leafLight : tone < 0.28 ? palette.leafDark : palette.leafMain;
    leafBits.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="0.92"/>`);
  }

  return [
    `<ellipse cx="${centerX - Math.round(width * 0.22)}" cy="${centerY + Math.round(height * 0.08)}" rx="${Math.round(
      width * 0.34,
    )}" ry="${Math.round(height * 0.28)}" fill="${palette.leafBack}"/>`,
    `<ellipse cx="${centerX + Math.round(width * 0.18)}" cy="${centerY + Math.round(height * 0.1)}" rx="${Math.round(
      width * 0.34,
    )}" ry="${Math.round(height * 0.3)}" fill="${palette.leafDark}"/>`,
    `<ellipse cx="${centerX}" cy="${centerY - Math.round(height * 0.08)}" rx="${Math.round(width * 0.36)}" ry="${Math.round(
      height * 0.32,
    )}" fill="${palette.leafMain}"/>`,
    `<ellipse cx="${centerX - Math.round(width * 0.3)}" cy="${centerY - Math.round(height * 0.18)}" rx="${Math.round(
      width * 0.22,
    )}" ry="${Math.round(height * 0.18)}" fill="${palette.leafLight}" opacity="0.74"/>`,
    `<ellipse cx="${centerX + Math.round(width * 0.26)}" cy="${centerY - Math.round(height * 0.05)}" rx="${Math.round(
      width * 0.26,
    )}" ry="${Math.round(height * 0.22)}" fill="${palette.leafMain}"/>`,
    `<ellipse cx="${centerX + Math.round(width * 0.12)}" cy="${centerY + Math.round(height * 0.22)}" rx="${Math.round(
      width * 0.28,
    )}" ry="${Math.round(height * 0.18)}" fill="${palette.underShade}" opacity="0.78"/>`,
    leafBits.join("\n"),
  ].join("\n");
}

function buildForegroundGroundSvg(
  test: PixelTreeRenderTestResult,
  palette: ReturnType<typeof getVolumePalette>,
  baseX: number,
  baseY: number,
): string {
  const random = createSeededRandom(`${test.fact.worldSeed}:${test.fact.id}:volume-ground-front`);
  const parts: string[] = [];

  for (let index = 0; index < 18; index += 1) {
    const x = baseX + Math.round((random() - 0.5) * test.decision.trunkWidth * 5.5);
    const height = Math.round(4 + random() * (test.fact.biome === "desert" ? 5 : 10));
    const color = random() > 0.62 ? palette.grassLight : palette.grass;
    parts.push(`<rect x="${x}" y="${baseY + Math.round((random() - 0.12) * 16) - height}" width="2" height="${height}" fill="${color}" opacity="0.9"/>`);
  }

  return parts.join("\n");
}

function getVolumePalette(biome: PixelTreeWorldFact["biome"]): {
  leafBack: string;
  leafDark: string;
  leafMain: string;
  leafLight: string;
  underShade: string;
  trunkDark: string;
  trunkMain: string;
  trunkLight: string;
  trunkSide: string;
  branch: string;
  soil: string;
  groundDark: string;
  grass: string;
  grassLight: string;
} {
  if (biome === "desert") {
    return {
      leafBack: "#5f6a38",
      leafDark: "#737a41",
      leafMain: "#8b934e",
      leafLight: "#c2c06c",
      underShade: "#4f552f",
      trunkDark: "#6b4b2b",
      trunkMain: "#9b7445",
      trunkLight: "#c79a5e",
      trunkSide: "#4a321b",
      branch: "#75512b",
      soil: "#6b5635",
      groundDark: "#2f2519",
      grass: "#8b8c4d",
      grassLight: "#b4aa63",
    };
  }

  if (biome === "oasis") {
    return {
      leafBack: "#23604d",
      leafDark: "#2f8066",
      leafMain: "#4b9d77",
      leafLight: "#8ed0a0",
      underShade: "#1c634e",
      trunkDark: "#604028",
      trunkMain: "#936139",
      trunkLight: "#bf8953",
      trunkSide: "#4e321f",
      branch: "#6e4a2d",
      soil: "#2e6149",
      groundDark: "#163228",
      grass: "#54ad77",
      grassLight: "#91d7a1",
    };
  }

  if (biome === "forest") {
    return {
      leafBack: "#1f5130",
      leafDark: "#2f7438",
      leafMain: "#3f873d",
      leafLight: "#7ec35c",
      underShade: "#154526",
      trunkDark: "#5a351f",
      trunkMain: "#8a5a31",
      trunkLight: "#b87a3a",
      trunkSide: "#3f2416",
      branch: "#6b4527",
      soil: "#2b4c31",
      groundDark: "#142319",
      grass: "#3f7d3c",
      grassLight: "#7ab85c",
    };
  }

  return {
    leafBack: "#2f6a37",
    leafDark: "#4c9144",
    leafMain: "#5da34d",
    leafLight: "#a5d66e",
    underShade: "#286333",
    trunkDark: "#654022",
    trunkMain: "#9a6838",
    trunkLight: "#c98d4b",
    trunkSide: "#4c2f18",
    branch: "#784d2a",
    soil: "#365d35",
    groundDark: "#1c2d1e",
    grass: "#5a9b45",
    grassLight: "#9fd36a",
  };
}

function extractDebugLabel(svg: string): string | null {
  const match = svg.match(/<text[^>]*>([^<]+)<\/text>/);
  return match?.[1] ?? null;
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
