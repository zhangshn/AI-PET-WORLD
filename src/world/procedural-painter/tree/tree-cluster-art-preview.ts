// 该文件用于测试把手绘像素树拆成可执行绘画算法。

import type { PixelTreeBiome, PixelTreeWorldFact } from "./tree-render-test-module";

type Palette = {
  bg: string;
  ground: string;
  groundDark: string;
  trunkDark: string;
  trunk: string;
  trunkLight: string;
  branch: string;
  leafBack: string;
  leafDark: string;
  leaf: string;
  leafLight: string;
  leafUnder: string;
  edgeChip: string;
  grass: string;
  grassLight: string;
};

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity?: number;
};

type TreeArtConfig = {
  baseX: number;
  baseY: number;
  trunkWidth: number;
  trunkHeight: number;
  crownScale: number;
  crownLift: number;
  crownSpread: number;
};

type LeafMass = {
  cx: number;
  cy: number;
  rows: number[];
  color: string;
  scaleX: number;
  scaleY: number;
  opacity?: number;
  jitter: number;
};

const SIZE = 3;
const OX = 16;
const OY = 18;

const BIG_MASS_ROWS = [6, 12, 18, 23, 27, 28, 26, 22, 17, 10, 5];
const MID_MASS_ROWS = [5, 10, 15, 19, 21, 20, 17, 12, 7];
const SMALL_MASS_ROWS = [3, 7, 11, 14, 15, 12, 8, 4];
const UNDER_MASS_ROWS = [12, 20, 26, 29, 26, 18, 10];

export function buildPixelClusterTreeSvg(fact: PixelTreeWorldFact): string {
  const clean = normalizeFact(fact);
  const random = seededRandom(`${clean.worldSeed}:${clean.id}:sketch-tree-algorithm-v1`);
  const palette = paletteFor(clean.biome);
  const config = buildArtConfig(clean);
  const crownBlocks = buildCrownBlocks(config, clean, palette, random);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" shape-rendering="crispEdges" role="img" aria-label="pixel tree sketch algorithm preview">`,
    `<rect x="0" y="0" width="320" height="320" fill="${palette.bg}"/>`,
    `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeText(
      `${clean.biome} sketch g${clean.growth} h${clean.health} m${clean.moisture}`,
    )}</text>`,
    renderGround(config, clean, palette, random),
    renderTrunk(config, palette),
    renderBranches(config, palette, random),
    renderBlocks(crownBlocks),
    renderFrontGrass(config, clean, palette, random),
    `</svg>`,
  ].join("\n");
}

function buildArtConfig(fact: PixelTreeWorldFact): TreeArtConfig {
  const growthRate = fact.growth / 100;
  const moistureRate = fact.moisture / 100;
  const biomeScale = fact.biome === "desert" ? 0.72 : fact.biome === "grassland" ? 1.05 : fact.biome === "oasis" ? 1.08 : 1;
  const crownSpread = fact.biome === "grassland" ? 1.18 : fact.biome === "forest" ? 1.04 : 1;

  return {
    baseX: 48,
    baseY: 82,
    trunkWidth: Math.round(6 + growthRate * 4),
    trunkHeight: Math.round((22 + growthRate * 14) * (fact.biome === "desert" ? 0.82 : 1)),
    crownScale: (0.76 + growthRate * 0.34 + moistureRate * 0.08) * biomeScale,
    crownLift: fact.biome === "desert" ? -2 : fact.biome === "forest" ? 2 : 0,
    crownSpread,
  };
}

function buildCrownBlocks(
  config: TreeArtConfig,
  fact: PixelTreeWorldFact,
  palette: Palette,
  random: () => number,
): Block[] {
  const centerX = config.baseX;
  const centerY = config.baseY - config.trunkHeight - Math.round(8 * config.crownScale) - config.crownLift;
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const blocks: Block[] = [];

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(7 * sx),
      cy: centerY + Math.round(2 * sy),
      rows: BIG_MASS_ROWS,
      color: palette.leafBack,
      scaleX: sx,
      scaleY: sy,
      opacity: 1,
      jitter: 2,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(9 * sx),
      cy: centerY + Math.round(4 * sy),
      rows: MID_MASS_ROWS,
      color: palette.leaf,
      scaleX: sx * 0.94,
      scaleY: sy,
      opacity: 1,
      jitter: 2,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(16 * sx),
      cy: centerY + Math.round(5 * sy),
      rows: MID_MASS_ROWS,
      color: palette.leafDark,
      scaleX: sx * 0.88,
      scaleY: sy * 0.96,
      opacity: 1,
      jitter: 2,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(12 * sx),
      cy: centerY - Math.round(5 * sy),
      rows: SMALL_MASS_ROWS,
      color: palette.leafLight,
      scaleX: sx * 0.82,
      scaleY: sy * 0.86,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(2 * sx),
      cy: centerY + Math.round(9 * sy),
      rows: UNDER_MASS_ROWS,
      color: palette.leafUnder,
      scaleX: sx,
      scaleY: sy * 0.84,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  addLeafAccentClusters(blocks, centerX, centerY, sx, sy, fact, palette, random);
  carveSmallAirGaps(blocks, centerX, centerY, sx, sy, random);

  return blocks;
}

function stampLeafMass(mass: LeafMass, random: () => number): Block[] {
  const blocks: Block[] = [];
  const rowStep = Math.max(1, Math.round(mass.scaleY));
  const totalHeight = mass.rows.length * rowStep;
  const topY = Math.round(mass.cy - totalHeight / 2);

  mass.rows.forEach((baseWidth, rowIndex) => {
    const width = Math.max(2, Math.round(baseWidth * mass.scaleX));
    const y = topY + rowIndex * rowStep;
    const jag = Math.round((random() - 0.5) * mass.jitter * 2);
    const x = Math.round(mass.cx - width / 2 + jag);

    blocks.push({
      x,
      y,
      w: width,
      h: rowStep,
      color: mass.color,
      opacity: mass.opacity,
    });

    if (random() > 0.72 && width > 10) {
      const chipSide = random() > 0.5 ? -1 : 1;
      blocks.push({
        x: chipSide < 0 ? x - 2 : x + width,
        y: y + Math.round(random() * Math.max(0, rowStep - 1)),
        w: random() > 0.55 ? 2 : 1,
        h: 1,
        color: mass.color,
        opacity: mass.opacity,
      });
    }
  });

  return blocks;
}

function addLeafAccentClusters(
  blocks: Block[],
  centerX: number,
  centerY: number,
  scaleX: number,
  scaleY: number,
  fact: PixelTreeWorldFact,
  palette: Palette,
  random: () => number,
): void {
  const healthRate = fact.health / 100;
  const clusterCount = Math.round(10 + healthRate * 12);

  for (let index = 0; index < clusterCount; index += 1) {
    const lightSide = random() > 0.42;
    const x = centerX + Math.round((lightSide ? -16 + random() * 18 : -8 + random() * 34) * scaleX);
    const y = centerY + Math.round((lightSide ? -9 + random() * 16 : -2 + random() * 19) * scaleY);
    const color = lightSide ? palette.leafLight : random() > 0.48 ? palette.leafDark : palette.edgeChip;
    const template = random() > 0.55 ? [[0, 0], [1, 0], [0, 1]] : [[0, 0], [1, 0], [2, 0], [1, 1]];

    for (const [dx, dy] of template) {
      blocks.push({
        x: x + dx,
        y: y + dy,
        w: 1,
        h: 1,
        color,
      });
    }
  }
}

function carveSmallAirGaps(
  blocks: Block[], centerX: number, centerY: number, sx: number, sy: number, random: () => number): void {
  for (let index = 0; index < 5; index += 1) {
    const x = centerX + Math.round((-9 + random() * 24) * sx);
    const y = centerY + Math.round((2 + random() * 12) * sy);
    const width = random() > 0.5 ? 3 : 2;

    blocks.push({
      x,
      y,
      w: width,
      h: 1,
      color: "#17231f",
      opacity: 0.72,
    });
  }
}

function renderTrunk(config: TreeArtConfig, palette: Palette): string {
  const x = config.baseX - Math.round(config.trunkWidth / 2);
  const y = config.baseY - config.trunkHeight;
  const darkWidth = Math.max(2, Math.round(config.trunkWidth * 0.28));
  const lightWidth = Math.max(1, Math.round(config.trunkWidth * 0.18));

  return [
    pixelRect(x, y, config.trunkWidth, config.trunkHeight, palette.trunkDark),
    pixelRect(x + darkWidth, y + 1, Math.max(2, config.trunkWidth - darkWidth - 1), config.trunkHeight - 2, palette.trunk),
    pixelRect(x + config.trunkWidth - lightWidth - 1, y + 5, lightWidth, Math.round(config.trunkHeight * 0.56), palette.trunkLight),
  ].join("\n");
}

function renderBranches(config: TreeArtConfig, palette: Palette, random: () => number): string {
  const parts: string[] = [];
  const originY = config.baseY - config.trunkHeight + Math.round(5 * config.crownScale);

  for (let index = 0; index < 4; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const startY = originY + index * 4;
    const endX = config.baseX + side * Math.round(8 + random() * 9);
    const endY = startY - Math.round(4 + random() * 7);

    parts.push(
      `<line x1="${sx(config.baseX)}" y1="${sy(startY)}" x2="${sx(endX)}" y2="${sy(endY)}" stroke="${palette.branch}" stroke-width="4" stroke-linecap="square" opacity="0.64"/>`,
    );
  }

  return parts.join("\n");
}

function renderGround(config: TreeArtConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): string {
  const parts: string[] = [
    `<ellipse cx="160" cy="266" rx="108" ry="26" fill="${palette.ground}" opacity="0.82"/>`,
    `<ellipse cx="${sx(config.baseX + 2)}" cy="${sy(config.baseY + 3)}" rx="${Math.round(44 * config.crownScale)}" ry="15" fill="${palette.groundDark}" opacity="0.32"/>`,
  ];
  const count = fact.biome === "desert" ? 10 : 18;

  for (let index = 0; index < count; index += 1) {
    const x = config.baseX + Math.round((random() - 0.5) * config.trunkWidth * 7);
    const y = config.baseY + Math.round(random() * 10);
    const color = random() > 0.55 ? palette.grass : palette.groundDark;
    parts.push(pixelRect(x, y, 1, 1, color, 0.78));
  }

  return parts.join("\n");
}

function renderFrontGrass(config: TreeArtConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): string {
  const parts: string[] = [];
  const count = fact.biome === "desert" ? 9 : fact.biome === "oasis" ? 28 : 20;

  for (let index = 0; index < count; index += 1) {
    const height = Math.round(2 + random() * (fact.biome === "desert" ? 3 : 6));
    const x = config.baseX + Math.round((random() - 0.5) * config.trunkWidth * 7);
    const y = config.baseY + Math.round((random() - 0.12) * 8) - height;
    const color = random() > 0.62 ? palette.grassLight : palette.grass;
    parts.push(pixelRect(x, y, 1, height, color));
  }

  return parts.join("\n");
}

function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((block) => pixelRect(block.x, block.y, block.w, block.h, block.color, block.opacity))
    .join("\n");
}

function pixelRect(x: number, y: number, w: number, h: number, color: string, opacity = 1): string {
  return `<rect x="${sx(x)}" y="${sy(y)}" width="${w * SIZE}" height="${h * SIZE}" fill="${color}" opacity="${opacity}"/>`;
}

function paletteFor(biome: PixelTreeBiome): Palette {
  if (biome === "desert") {
    return {
      bg: "#17231f",
      ground: "#2a3827",
      groundDark: "#2f2519",
      trunkDark: "#6b4b2b",
      trunk: "#9b7445",
      trunkLight: "#c79a5e",
      branch: "#75512b",
      leafBack: "#5f6a38",
      leafDark: "#4b512d",
      leaf: "#8b934e",
      leafLight: "#c2c06c",
      leafUnder: "#384020",
      edgeChip: "#535f32",
      grass: "#8b8c4d",
      grassLight: "#b4aa63",
    };
  }

  if (biome === "oasis") {
    return {
      bg: "#17231f",
      ground: "#263f2f",
      groundDark: "#163228",
      trunkDark: "#604028",
      trunk: "#936139",
      trunkLight: "#bf8953",
      branch: "#6e4a2d",
      leafBack: "#23604d",
      leafDark: "#1c634e",
      leaf: "#4b9d77",
      leafLight: "#8ed0a0",
      leafUnder: "#16483b",
      edgeChip: "#1b5a49",
      grass: "#54ad77",
      grassLight: "#91d7a1",
    };
  }

  if (biome === "forest") {
    return {
      bg: "#17231f",
      ground: "#263f2f",
      groundDark: "#142319",
      trunkDark: "#5a351f",
      trunk: "#8a5a31",
      trunkLight: "#b87a3a",
      branch: "#6b4527",
      leafBack: "#1f5130",
      leafDark: "#154526",
      leaf: "#3f873d",
      leafLight: "#7ec35c",
      leafUnder: "#10351e",
      edgeChip: "#173f26",
      grass: "#3f7d3c",
      grassLight: "#7ab85c",
    };
  }

  return {
    bg: "#17231f",
    ground: "#263f2f",
    groundDark: "#1c2d1e",
    trunkDark: "#654022",
    trunk: "#9a6838",
    trunkLight: "#c98d4b",
    branch: "#784d2a",
    leafBack: "#2f6a37",
    leafDark: "#286333",
    leaf: "#5da34d",
    leafLight: "#a5d66e",
    leafUnder: "#1f4d28",
    edgeChip: "#275c31",
    grass: "#5a9b45",
    grassLight: "#9fd36a",
  };
}

function normalizeFact(fact: PixelTreeWorldFact): PixelTreeWorldFact {
  return {
    ...fact,
    growth: clamp(Math.round(fact.growth), 0, 100),
    health: clamp(Math.round(fact.health), 0, 100),
    moisture: clamp(Math.round(fact.moisture), 0, 100),
    age: clamp(Math.round(fact.age), 0, 300),
  };
}

function sx(x: number): number {
  return OX + x * SIZE;
}

function sy(y: number): number {
  return OY + y * SIZE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function seededRandom(seed: string): () => number {
  let state = hash(seed);

  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let current = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }

  return current >>> 0;
}
