// 该文件用于测试把手绘像素树拆成可执行绘画算法。

import type { PixelTreeBiome, PixelTreeWorldFact } from "./tree-render-test-module";

type GrowthStage = "seedling" | "sapling" | "young" | "growing" | "mature";

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
  stage: GrowthStage;
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

const WIDE_MASS_ROWS = [4, 9, 15, 21, 27, 32, 34, 33, 29, 23, 16, 9, 4];
const MAIN_MASS_ROWS = [5, 11, 17, 22, 25, 26, 24, 20, 14, 8, 3];
const SMALL_MASS_ROWS = [3, 7, 12, 16, 18, 16, 11, 6, 2];
const UNDER_MASS_ROWS = [8, 15, 23, 29, 31, 27, 19, 10, 4];
const SAPLING_ROWS = [2, 5, 8, 10, 9, 6, 3];
const YOUNG_ROWS = [3, 7, 12, 16, 19, 18, 14, 8, 3];

export function buildPixelClusterTreeSvg(fact: PixelTreeWorldFact): string {
  const clean = normalizeFact(fact);
  const stage = resolveGrowthStage(clean.growth);
  const random = seededRandom(`${clean.worldSeed}:${clean.id}:sketch-tree-stage-v1:${stage}`);
  const palette = paletteFor(clean.biome);
  const config = buildArtConfig(clean, stage);
  const crownBlocks = buildCrownBlocks(config, clean, palette, random);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" shape-rendering="crispEdges" role="img" aria-label="pixel tree sketch algorithm preview">`,
    `<rect x="0" y="0" width="320" height="320" fill="${palette.bg}"/>`,
    `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeText(
      `${clean.biome} ${stage} g${clean.growth} h${clean.health} m${clean.moisture}`,
    )}</text>`,
    renderGround(config, clean, palette, random),
    renderBranches(config, palette, random),
    renderTrunk(config, palette),
    renderBlocks(crownBlocks),
    renderFrontGrass(config, clean, palette, random),
    `</svg>`,
  ].join("\n");
}

function resolveGrowthStage(growth: number): GrowthStage {
  if (growth <= 10) {
    return "seedling";
  }

  if (growth <= 30) {
    return "sapling";
  }

  if (growth <= 60) {
    return "young";
  }

  if (growth <= 85) {
    return "growing";
  }

  return "mature";
}

function buildArtConfig(fact: PixelTreeWorldFact, stage: GrowthStage): TreeArtConfig {
  const growthRate = fact.growth / 100;
  const moistureRate = fact.moisture / 100;
  const biomeScale = fact.biome === "desert" ? 0.72 : fact.biome === "grassland" ? 1.03 : fact.biome === "oasis" ? 1.06 : 1;
  const crownSpread = fact.biome === "grassland" ? 1.12 : fact.biome === "forest" ? 1.02 : 1;
  const baseConfig = {
    baseX: 48,
    baseY: 82,
    stage,
    crownLift: fact.biome === "desert" ? -2 : fact.biome === "forest" ? 1 : 0,
    crownSpread,
  };

  if (stage === "seedling") {
    return {
      ...baseConfig,
      trunkWidth: 2,
      trunkHeight: 8 + Math.round(growthRate * 12),
      crownScale: 0.34 + moistureRate * 0.04,
    };
  }

  if (stage === "sapling") {
    return {
      ...baseConfig,
      trunkWidth: 3 + Math.round(growthRate * 3),
      trunkHeight: Math.round((13 + growthRate * 18) * (fact.biome === "desert" ? 0.86 : 1)),
      crownScale: (0.48 + growthRate * 0.36 + moistureRate * 0.06) * biomeScale,
    };
  }

  if (stage === "young") {
    return {
      ...baseConfig,
      trunkWidth: 4 + Math.round(growthRate * 4),
      trunkHeight: Math.round((17 + growthRate * 19) * (fact.biome === "desert" ? 0.84 : 1)),
      crownScale: (0.62 + growthRate * 0.34 + moistureRate * 0.07) * biomeScale,
    };
  }

  return {
    ...baseConfig,
    trunkWidth: Math.round(6 + growthRate * 4),
    trunkHeight: Math.round((22 + growthRate * 14) * (fact.biome === "desert" ? 0.82 : 1)),
    crownScale: (0.86 + growthRate * 0.3 + moistureRate * 0.08) * biomeScale,
  };
}

function buildCrownBlocks(
  config: TreeArtConfig,
  fact: PixelTreeWorldFact,
  palette: Palette,
  random: () => number,
): Block[] {
  if (config.stage === "seedling") {
    return buildSeedlingBlocks(config, palette, random);
  }

  if (config.stage === "sapling") {
    return buildSaplingBlocks(config, fact, palette, random);
  }

  if (config.stage === "young") {
    return buildYoungTreeBlocks(config, fact, palette, random);
  }

  return buildFullCrownBlocks(config, fact, palette, random);
}

function buildSeedlingBlocks(config: TreeArtConfig, palette: Palette, random: () => number): Block[] {
  const topY = config.baseY - config.trunkHeight;
  const leafY = topY - 3;
  const leafSpread = random() > 0.5 ? 1 : 0;

  return [
    { x: config.baseX - 4 - leafSpread, y: leafY, w: 4, h: 1, color: palette.leafLight },
    { x: config.baseX - 5 - leafSpread, y: leafY + 1, w: 5, h: 1, color: palette.leaf },
    { x: config.baseX + 1 + leafSpread, y: leafY, w: 4, h: 1, color: palette.leaf },
    { x: config.baseX + 1 + leafSpread, y: leafY + 1, w: 5, h: 1, color: palette.leafDark },
    { x: config.baseX - 1, y: leafY + 2, w: 3, h: 1, color: palette.leafUnder },
  ];
}

function buildSaplingBlocks(
  config: TreeArtConfig,
  fact: PixelTreeWorldFact,
  palette: Palette,
  random: () => number,
): Block[] {
  const centerX = config.baseX;
  const centerY = config.baseY - config.trunkHeight - Math.round(3 * config.crownScale);
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const blocks: Block[] = [];

  blocks.push(
    ...stampLeafMass({
      cx: centerX,
      cy: centerY,
      rows: SAPLING_ROWS,
      color: palette.leaf,
      scaleX: sx * 0.9,
      scaleY: sy * 0.95,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(5 * sx),
      cy: centerY - Math.round(2 * sy),
      rows: [2, 5, 7, 6, 3],
      color: palette.leafLight,
      scaleX: sx * 0.7,
      scaleY: sy * 0.72,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  if (fact.growth > 20) {
    blocks.push(
      ...stampLeafMass({
        cx: centerX + Math.round(6 * sx),
        cy: centerY + Math.round(1 * sy),
        rows: [2, 5, 8, 7, 4],
        color: palette.leafDark,
        scaleX: sx * 0.72,
        scaleY: sy * 0.74,
        opacity: 1,
        jitter: 1,
      }, random),
    );
  }

  addLeafAccentClusters(blocks, centerX, centerY, sx * 0.58, sy * 0.58, fact, palette, random);
  return blocks;
}

function buildYoungTreeBlocks(
  config: TreeArtConfig,
  fact: PixelTreeWorldFact,
  palette: Palette,
  random: () => number,
): Block[] {
  const centerX = config.baseX;
  const centerY = config.baseY - config.trunkHeight - Math.round(2 * config.crownScale) - config.crownLift;
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const blocks: Block[] = [];

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(3 * sx),
      cy: centerY,
      rows: YOUNG_ROWS,
      color: palette.leaf,
      scaleX: sx * 0.9,
      scaleY: sy * 0.92,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(8 * sx),
      cy: centerY - Math.round(2 * sy),
      rows: SMALL_MASS_ROWS,
      color: palette.leafLight,
      scaleX: sx * 0.7,
      scaleY: sy * 0.74,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(11 * sx),
      cy: centerY + Math.round(2 * sy),
      rows: SMALL_MASS_ROWS,
      color: palette.leafDark,
      scaleX: sx * 0.68,
      scaleY: sy * 0.7,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  if (fact.growth > 45) {
    blocks.push(
      ...stampLeafMass({
        cx: centerX + Math.round(1 * sx),
        cy: centerY + Math.round(7 * sy),
        rows: [5, 10, 15, 17, 13, 7],
        color: palette.leafUnder,
        scaleX: sx * 0.78,
        scaleY: sy * 0.7,
        opacity: 1,
        jitter: 1,
      }, random),
    );
  }

  addLeafAccentClusters(blocks, centerX, centerY, sx * 0.75, sy * 0.75, fact, palette, random);
  carveSmallAirGaps(blocks, centerX, centerY, sx * 0.72, sy * 0.72, random);
  return blocks;
}

function buildFullCrownBlocks(
  config: TreeArtConfig,
  fact: PixelTreeWorldFact,
  palette: Palette,
  random: () => number,
): Block[] {
  const centerX = config.baseX;
  const centerY = config.baseY - config.trunkHeight - Math.round(2 * config.crownScale) - config.crownLift;
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const maturityScale = config.stage === "growing" ? 0.9 : 1;
  const blocks: Block[] = [];

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(7 * sx),
      cy: centerY,
      rows: WIDE_MASS_ROWS,
      color: palette.leafBack,
      scaleX: sx * 0.92 * maturityScale,
      scaleY: sy * 0.92 * maturityScale,
      opacity: 1,
      jitter: 2,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(2 * sx),
      cy: centerY + Math.round(1 * sy),
      rows: MAIN_MASS_ROWS,
      color: palette.leaf,
      scaleX: sx * 1.08 * maturityScale,
      scaleY: sy * maturityScale,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(14 * sx),
      cy: centerY + Math.round(3 * sy),
      rows: MAIN_MASS_ROWS,
      color: palette.leaf,
      scaleX: sx * 0.82 * maturityScale,
      scaleY: sy * 0.9 * maturityScale,
      opacity: 1,
      jitter: 2,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(18 * sx),
      cy: centerY + Math.round(3 * sy),
      rows: MAIN_MASS_ROWS,
      color: palette.leafDark,
      scaleX: sx * 0.84 * maturityScale,
      scaleY: sy * 0.9 * maturityScale,
      opacity: 1,
      jitter: 2,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX - Math.round(9 * sx),
      cy: centerY - Math.round(7 * sy),
      rows: SMALL_MASS_ROWS,
      color: palette.leafLight,
      scaleX: sx * 0.9 * maturityScale,
      scaleY: sy * 0.88 * maturityScale,
      opacity: 1,
      jitter: 1,
    }, random),
  );

  blocks.push(
    ...stampLeafMass({
      cx: centerX + Math.round(1 * sx),
      cy: centerY + Math.round(9 * sy),
      rows: UNDER_MASS_ROWS,
      color: palette.leafUnder,
      scaleX: sx * 0.94 * maturityScale,
      scaleY: sy * 0.82 * maturityScale,
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
  const rowStep = Math.max(1, Math.round(mass.scaleY * 1.32));
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

    if (random() > 0.78 && width > 12) {
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
  const stage = resolveGrowthStage(fact.growth);
  const stageFactor = stage === "sapling" ? 0.3 : stage === "young" ? 0.58 : stage === "growing" ? 0.78 : 1;
  const clusterCount = Math.round((12 + healthRate * 12) * stageFactor);

  for (let index = 0; index < clusterCount; index += 1) {
    const lightSide = random() > 0.44;
    const x = centerX + Math.round((lightSide ? -18 + random() * 19 : -4 + random() * 32) * scaleX);
    const y = centerY + Math.round((lightSide ? -12 + random() * 16 : -4 + random() * 21) * scaleY);
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

function carveSmallAirGaps(blocks: Block[], centerX: number, centerY: number, sx: number, sy: number, random: () => number): void {
  for (let index = 0; index < 4; index += 1) {
    const x = centerX + Math.round((-6 + random() * 22) * sx);
    const y = centerY + Math.round((4 + random() * 11) * sy);
    const width = random() > 0.5 ? 3 : 2;

    blocks.push({
      x,
      y,
      w: width,
      h: 1,
      color: "#17231f",
      opacity: 0.58,
    });
  }
}

function renderTrunk(config: TreeArtConfig, palette: Palette): string {
  const x = config.baseX - Math.round(config.trunkWidth / 2);
  const y = config.baseY - config.trunkHeight;

  if (config.stage === "seedling") {
    return pixelRect(config.baseX, y, 1, config.trunkHeight, palette.trunkLight);
  }

  const darkWidth = Math.max(1, Math.round(config.trunkWidth * 0.28));
  const lightWidth = Math.max(1, Math.round(config.trunkWidth * 0.18));

  return [
    pixelRect(x, y, config.trunkWidth, config.trunkHeight, palette.trunkDark),
    pixelRect(x + darkWidth, y + 1, Math.max(1, config.trunkWidth - darkWidth - 1), Math.max(1, config.trunkHeight - 2), palette.trunk),
    pixelRect(x + config.trunkWidth - lightWidth - 1, y + 5, lightWidth, Math.round(config.trunkHeight * 0.56), palette.trunkLight),
  ].join("\n");
}

function renderBranches(config: TreeArtConfig, palette: Palette, random: () => number): string {
  if (config.stage === "seedling") {
    return "";
  }

  const parts: string[] = [];
  const originY = config.baseY - config.trunkHeight + Math.round(7 * config.crownScale);
  const branchCount = config.stage === "sapling" ? 2 : config.stage === "young" ? 3 : 4;
  const maxLength = config.stage === "sapling" ? 5 : config.stage === "young" ? 8 : 13;

  for (let index = 0; index < branchCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const startY = originY + index * 3;
    const endX = config.baseX + side * Math.round(4 + random() * maxLength);
    const endY = startY - Math.round(2 + random() * 5);

    parts.push(
      `<line x1="${sx(config.baseX)}" y1="${sy(startY)}" x2="${sx(endX)}" y2="${sy(endY)}" stroke="${palette.branch}" stroke-width="${config.stage === "sapling" ? 2 : 3}" stroke-linecap="square" opacity="0.42"/>`,
    );
  }

  return parts.join("\n");
}

function renderGround(config: TreeArtConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): string {
  const shadowRadius = config.stage === "seedling" ? 14 : config.stage === "sapling" ? 24 : Math.round(44 * config.crownScale);
  const baseGroundRadius = config.stage === "seedling" ? 64 : config.stage === "sapling" ? 78 : 108;
  const parts: string[] = [
    `<ellipse cx="160" cy="266" rx="${baseGroundRadius}" ry="26" fill="${palette.ground}" opacity="0.82"/>`,
    `<ellipse cx="${sx(config.baseX + 2)}" cy="${sy(config.baseY + 3)}" rx="${shadowRadius}" ry="15" fill="${palette.groundDark}" opacity="0.32"/>`,
  ];
  const stageCount = config.stage === "seedling" ? 5 : config.stage === "sapling" ? 9 : config.stage === "young" ? 13 : 18;
  const count = fact.biome === "desert" ? Math.max(4, Math.round(stageCount * 0.65)) : stageCount;

  for (let index = 0; index < count; index += 1) {
    const x = config.baseX + Math.round((random() - 0.5) * Math.max(12, config.trunkWidth * 7));
    const y = config.baseY + Math.round(random() * 10);
    const color = random() > 0.55 ? palette.grass : palette.groundDark;
    parts.push(pixelRect(x, y, 1, 1, color, 0.78));
  }

  return parts.join("\n");
}

function renderFrontGrass(config: TreeArtConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): string {
  const parts: string[] = [];
  const stageCount = config.stage === "seedling" ? 5 : config.stage === "sapling" ? 9 : config.stage === "young" ? 14 : 20;
  const count = fact.biome === "desert" ? Math.max(4, Math.round(stageCount * 0.45)) : fact.biome === "oasis" ? stageCount + 8 : stageCount;

  for (let index = 0; index < count; index += 1) {
    const height = Math.round(2 + random() * (fact.biome === "desert" ? 3 : 6));
    const x = config.baseX + Math.round((random() - 0.5) * Math.max(12, config.trunkWidth * 7));
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
