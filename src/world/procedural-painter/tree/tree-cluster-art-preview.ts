// 该文件用于测试把手绘像素树拆成可执行绘画算法。

import type { PixelTreeBiome, PixelTreeWorldFact } from "./tree-render-test-module";

type GrowthStage = "seedling" | "sapling" | "young" | "growing" | "mature";
type HealthStage = "withered" | "depleted" | "stressed" | "healthy" | "thriving";
type AgeStage = "new" | "young_age" | "adult_age" | "old_age";
type Block = { x: number; y: number; w: number; h: number; color: string; opacity?: number };
type Palette = {
  bg: string; shadow: string; shadowDark: string; trunkDark: string; trunk: string; trunkLight: string;
  branch: string; leafBack: string; leafDark: string; leaf: string; leafLight: string; leafUnder: string;
  edgeChip: string;
};
type TreeConfig = {
  baseX: number; baseY: number; growth: GrowthStage; health: HealthStage; age: number; ageStage: AgeStage;
  trunkWidth: number; trunkHeight: number; crownScale: number; crownSpread: number;
};
type LeafMass = { cx: number; cy: number; rows: number[]; color: string; sx: number; sy: number; jitter: number };

const SIZE = 3;
const OX = 16;
const OY = 18;
const ROWS = {
  wide: [4, 9, 15, 21, 27, 32, 34, 33, 29, 23, 16, 9, 4],
  main: [5, 11, 17, 22, 25, 26, 24, 20, 14, 8, 3],
  small: [3, 7, 12, 16, 18, 16, 11, 6, 2],
  under: [8, 15, 23, 29, 31, 27, 19, 10, 4],
  sapling: [2, 5, 8, 10, 9, 6, 3],
  young: [3, 7, 12, 16, 19, 18, 14, 8, 3],
};

export function buildPixelClusterTreeSvg(fact: PixelTreeWorldFact): string {
  const clean = normalizeFact(fact);
  const growth = resolveGrowthStage(clean.growth);
  const health = resolveHealthStage(clean.health);
  const ageStage = resolveAgeStage(clean.age);
  const random = seededRandom(`${clean.worldSeed}:${clean.id}:tree-age-v1:${growth}:${health}:${ageStage}`);
  const palette = paletteFor(clean.biome, health);
  const config = buildConfig(clean, growth, health, ageStage);
  const label = `${clean.biome} ${growth}/${health}/${ageStage} g${clean.growth} h${clean.health} m${clean.moisture} a${clean.age}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" shape-rendering="crispEdges" role="img" aria-label="single pixel tree preview" data-visual-scope="tree_only">`,
    `<rect x="0" y="0" width="320" height="320" fill="${palette.bg}"/>`,
    `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeText(label)}</text>`,
    renderTreeShadow(config, palette),
    renderBranches(config, palette, random),
    renderTrunk(config, palette),
    renderBlocks(buildCrown(config, clean, palette, random)),
    `</svg>`,
  ].join("\n");
}

function resolveGrowthStage(growth: number): GrowthStage {
  if (growth <= 10) return "seedling";
  if (growth <= 30) return "sapling";
  if (growth <= 60) return "young";
  if (growth <= 85) return "growing";
  return "mature";
}

function resolveHealthStage(health: number): HealthStage {
  if (health <= 8) return "withered";
  if (health <= 32) return "depleted";
  if (health <= 62) return "stressed";
  if (health <= 88) return "healthy";
  return "thriving";
}

function resolveAgeStage(age: number): AgeStage {
  if (age <= 8) return "new";
  if (age <= 36) return "young_age";
  if (age <= 96) return "adult_age";
  return "old_age";
}

function buildConfig(fact: PixelTreeWorldFact, growth: GrowthStage, health: HealthStage, ageStage: AgeStage): TreeConfig {
  const g = fact.growth / 100;
  const m = fact.moisture / 100;
  const ageRate = clamp(fact.age / 120, 0, 1);
  const biomeScale = fact.biome === "desert" ? 0.72 : fact.biome === "grassland" ? 1.03 : fact.biome === "oasis" ? 1.06 : 1;
  const healthScale = health === "withered" ? 0.46 : health === "depleted" ? 0.62 : health === "stressed" ? 0.82 : health === "healthy" ? 0.96 : 1.04;
  const trunkScale = health === "withered" ? 0.84 : health === "depleted" ? 0.92 : 1;
  const spread = fact.biome === "grassland" ? 1.12 : fact.biome === "forest" ? 1.02 : 1;
  const ageWidth = growth === "seedling" ? 0 : growth === "sapling" ? Math.round(ageRate) : growth === "young" ? Math.round(ageRate * 2) : Math.round(ageRate * 5);
  const ageHeight = growth === "seedling" ? 0 : growth === "sapling" ? Math.round(ageRate) : growth === "young" ? Math.round(ageRate * 2) : Math.round(ageRate * 3);
  const ageCrown = growth === "seedling" ? 1 : 1 + ageRate * 0.04;
  const base = { baseX: 48, baseY: 82, growth, health, age: fact.age, ageStage, crownSpread: spread };

  if (growth === "seedling") return { ...base, trunkWidth: 2, trunkHeight: Math.round((8 + g * 12) * trunkScale), crownScale: (0.34 + m * 0.04) * healthScale };
  if (growth === "sapling") return { ...base, trunkWidth: Math.max(2, Math.round((3 + g * 3) * trunkScale) + ageWidth), trunkHeight: Math.round((13 + g * 18) * trunkScale) + ageHeight, crownScale: (0.48 + g * 0.36 + m * 0.06) * biomeScale * healthScale * ageCrown };
  if (growth === "young") return { ...base, trunkWidth: Math.max(3, Math.round((4 + g * 4) * trunkScale) + ageWidth), trunkHeight: Math.round((17 + g * 19) * trunkScale) + ageHeight, crownScale: (0.62 + g * 0.34 + m * 0.07) * biomeScale * healthScale * ageCrown };
  return { ...base, trunkWidth: Math.max(4, Math.round((6 + g * 4) * trunkScale) + ageWidth), trunkHeight: Math.round((22 + g * 14) * trunkScale) + ageHeight, crownScale: (0.86 + g * 0.3 + m * 0.08) * biomeScale * healthScale * ageCrown };
}

function buildCrown(config: TreeConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): Block[] {
  if (config.health === "withered") return buildWitheredCrown(config, fact, palette, random);
  if (config.growth === "seedling") return buildSeedling(config, palette, random);
  if (config.growth === "sapling") return buildSapling(config, fact, palette, random);
  if (config.growth === "young") return buildYoungCrown(config, fact, palette, random);
  return buildMatureCrown(config, fact, palette, random);
}

function buildWitheredCrown(config: TreeConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): Block[] {
  const top = config.baseY - config.trunkHeight;
  if (config.growth === "seedling") return [{ x: config.baseX - 1, y: top - 2, w: 3, h: 1, color: palette.leafUnder }];

  const blocks: Block[] = [];
  const centerY = top - Math.round(3 * config.crownScale);
  const clumps = config.growth === "sapling" ? 2 : config.growth === "young" ? 3 : 5;

  for (let index = 0; index < clumps; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = config.baseX + side * Math.round((5 + random() * 15) * config.crownScale);
    const y = centerY + Math.round((-2 + random() * 11) * config.crownScale);
    const width = Math.max(2, Math.round((3 + random() * 5) * config.crownScale));
    blocks.push({ x: x - Math.round(width / 2), y, w: width, h: 1, color: random() > 0.5 ? palette.leafDark : palette.leafUnder });
    if (random() > 0.45) blocks.push({ x: x - 1, y: y + 1, w: Math.max(1, Math.round(width * 0.5)), h: 1, color: palette.edgeChip });
  }

  if (fact.moisture > 58 && config.growth !== "sapling") {
    blocks.push(...stampLeafMass({ cx: config.baseX - 7, cy: centerY - 5, rows: [2, 4, 5, 4, 2], color: palette.leafLight, sx: config.crownScale * 0.45, sy: config.crownScale * 0.45, jitter: 1 }, random));
  }

  return blocks;
}

function buildSeedling(config: TreeConfig, palette: Palette, random: () => number): Block[] {
  const leafY = config.baseY - config.trunkHeight - 3;
  const spread = random() > 0.5 ? 1 : 0;
  return [
    { x: config.baseX - 4 - spread, y: leafY, w: 4, h: 1, color: palette.leafLight },
    { x: config.baseX - 5 - spread, y: leafY + 1, w: 5, h: 1, color: palette.leaf },
    { x: config.baseX + 1 + spread, y: leafY, w: 4, h: 1, color: palette.leaf },
    { x: config.baseX + 1 + spread, y: leafY + 1, w: 5, h: 1, color: palette.leafDark },
  ];
}

function buildSapling(config: TreeConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): Block[] {
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const cy = config.baseY - config.trunkHeight - Math.round(3 * sy);
  const dense = config.health === "depleted" ? 0.68 : config.health === "stressed" ? 0.82 : 1;
  const blocks = stampLeafMass({ cx: config.baseX, cy, rows: ROWS.sapling, color: palette.leaf, sx: sx * 0.9 * dense, sy: sy * 0.95 * dense, jitter: 1 }, random);

  if (config.health !== "depleted") blocks.push(...stampLeafMass({ cx: config.baseX - Math.round(5 * sx), cy: cy - Math.round(2 * sy), rows: [2, 5, 7, 6, 3], color: palette.leafLight, sx: sx * 0.7 * dense, sy: sy * 0.72 * dense, jitter: 1 }, random));
  if (fact.growth > 20 && config.health !== "depleted") blocks.push(...stampLeafMass({ cx: config.baseX + Math.round(6 * sx), cy: cy + Math.round(1 * sy), rows: [2, 5, 8, 7, 4], color: palette.leafDark, sx: sx * 0.72 * dense, sy: sy * 0.74 * dense, jitter: 1 }, random));
  addLeafAccentClusters(blocks, config.baseX, cy, sx * 0.58, sy * 0.58, fact, palette, random);
  return blocks;
}

function buildYoungCrown(config: TreeConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): Block[] {
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const cy = config.baseY - config.trunkHeight - Math.round(2 * sy);
  const dense = config.health === "depleted" ? 0.62 : config.health === "stressed" ? 0.8 : 1;
  const blocks = stampLeafMass({ cx: config.baseX + Math.round(3 * sx), cy, rows: ROWS.young, color: palette.leaf, sx: sx * 0.9 * dense, sy: sy * 0.92 * dense, jitter: 1 }, random);

  if (config.health !== "depleted") blocks.push(...stampLeafMass({ cx: config.baseX - Math.round(8 * sx), cy: cy - Math.round(2 * sy), rows: ROWS.small, color: palette.leafLight, sx: sx * 0.7 * dense, sy: sy * 0.74 * dense, jitter: 1 }, random));
  blocks.push(...stampLeafMass({ cx: config.baseX + Math.round(11 * sx), cy: cy + Math.round(2 * sy), rows: ROWS.small, color: palette.leafDark, sx: sx * 0.68 * dense, sy: sy * 0.7 * dense, jitter: 1 }, random));
  if (fact.growth > 45 && config.health !== "depleted") blocks.push(...stampLeafMass({ cx: config.baseX + Math.round(1 * sx), cy: cy + Math.round(7 * sy), rows: [5, 10, 15, 17, 13, 7], color: palette.leafUnder, sx: sx * 0.78 * dense, sy: sy * 0.7 * dense, jitter: 1 }, random));
  addLeafAccentClusters(blocks, config.baseX, cy, sx * 0.6, sy * 0.6, fact, palette, random);
  return blocks;
}

function buildMatureCrown(config: TreeConfig, fact: PixelTreeWorldFact, palette: Palette, random: () => number): Block[] {
  const sx = config.crownScale * config.crownSpread;
  const sy = config.crownScale;
  const cy = config.baseY - config.trunkHeight - Math.round(2 * sy);
  const dense = config.health === "depleted" ? 0.58 : config.health === "stressed" ? 0.78 : 1;
  const blocks: Block[] = [];
  blocks.push(...stampLeafMass({ cx: config.baseX - Math.round(8 * sx), cy: cy - Math.round(5 * sy), rows: ROWS.small, color: palette.leafLight, sx: sx * 0.84 * dense, sy: sy * 0.72 * dense, jitter: 1 }, random));
  blocks.push(...stampLeafMass({ cx: config.baseX + Math.round(2 * sx), cy, rows: ROWS.wide, color: palette.leaf, sx: sx * 1.03 * dense, sy: sy * 0.92 * dense, jitter: 2 }, random));
  blocks.push(...stampLeafMass({ cx: config.baseX + Math.round(15 * sx), cy: cy + Math.round(3 * sy), rows: ROWS.main, color: palette.leafDark, sx: sx * 0.82 * dense, sy: sy * 0.85 * dense, jitter: 2 }, random));
  blocks.push(...stampLeafMass({ cx: config.baseX + Math.round(2 * sx), cy: cy + Math.round(8 * sy), rows: ROWS.under, color: palette.leafUnder, sx: sx * 0.94 * dense, sy: sy * 0.74 * dense, jitter: 1 }, random));
  addLeafAccentClusters(blocks, config.baseX, cy, sx * 0.7, sy * 0.66, fact, palette, random);
  return blocks;
}

function stampLeafMass(mass: LeafMass, random: () => number): Block[] {
  const rowStep = Math.max(1, Math.round(2 * mass.sy));
  const topY = Math.round(mass.cy - (mass.rows.length * rowStep) / 2);
  return mass.rows.flatMap((baseWidth, rowIndex) => {
    const width = Math.max(1, Math.round(baseWidth * mass.sx));
    const y = topY + rowIndex * rowStep;
    const x = Math.round(mass.cx - width / 2 + (random() - 0.5) * mass.jitter * 2);
    const blocks: Block[] = [{ x, y, w: width, h: rowStep, color: mass.color }];
    if (random() > 0.78 && width > 12) {
      const side = random() > 0.5 ? -1 : 1;
      blocks.push({ x: side < 0 ? x - 1 : x + width, y: y + Math.round(random() * Math.max(0, rowStep - 1)), w: random() > 0.5 ? 2 : 1, h: 1, color: mass.color });
    }
    return blocks;
  });
}

function addLeafAccentClusters(blocks: Block[], cx: number, cy: number, sx: number, sy: number, fact: PixelTreeWorldFact, palette: Palette, random: () => number): void {
  const healthFactor = fact.health / 100;
  const count = Math.round((8 + healthFactor * 16) * (fact.growth < 30 ? 0.42 : 1) * (fact.health < 25 ? 0.22 : 1));
  for (let index = 0; index < count; index += 1) {
    const light = random() > 0.42;
    const x = cx + Math.round((light ? -18 + random() * 22 : -4 + random() * 34) * sx);
    const y = cy + Math.round((light ? -12 + random() * 18 : -3 + random() * 22) * sy);
    const color = light ? palette.leafLight : random() > 0.5 ? palette.leafDark : palette.edgeChip;
    const template = random() > 0.5 ? [[0, 0], [1, 0], [0, 1]] : [[0, 0], [1, 0], [2, 0], [1, 1]];
    template.forEach(([dx, dy]) => blocks.push({ x: x + dx, y: y + dy, w: 1, h: 1, color }));
  }
}

function renderTreeShadow(config: TreeConfig, palette: Palette): string {
  const ageShadow = Math.round(clamp(config.age / 120, 0, 1) * 10);
  const shadow = (config.growth === "seedling" ? 14 : config.growth === "sapling" ? 24 : Math.round(44 * config.crownScale)) + ageShadow;
  const opacity = config.health === "withered" ? 0.22 : config.health === "depleted" ? 0.26 : 0.32;
  return `<ellipse cx="${sx(config.baseX + 2)}" cy="${sy(config.baseY + 3)}" rx="${shadow}" ry="15" fill="${palette.shadowDark}" opacity="${opacity}"/>`;
}

function renderTrunk(config: TreeConfig, palette: Palette): string {
  const rings = config.ageStage === "old_age" ? 3 : config.ageStage === "adult_age" ? 2 : config.ageStage === "young_age" ? 1 : 0;
  const x = config.baseX - Math.floor(config.trunkWidth / 2);
  const y = config.baseY - config.trunkHeight;
  const dark = Math.max(1, Math.floor(config.trunkWidth * 0.28));
  const light = Math.max(1, Math.floor(config.trunkWidth * 0.18));
  const lightHeight = Math.max(3, Math.round(config.trunkHeight * 0.54));
  const parts = [
    pixelRect(x, y, config.trunkWidth, config.trunkHeight, palette.trunkDark),
    pixelRect(x + dark, y + 1, Math.max(1, config.trunkWidth - dark - 1), Math.max(1, config.trunkHeight - 2), palette.trunk),
    pixelRect(x + config.trunkWidth - light - 1, y + 5, light, Math.max(1, lightHeight), palette.trunkLight),
  ];

  if (config.age >= 24) {
    parts.push(pixelRect(x - 1, y + config.trunkHeight - 2, 1, 2, palette.trunkDark));
    parts.push(pixelRect(x + config.trunkWidth, y + config.trunkHeight - 2, 1, 2, palette.trunkDark));
  }

  for (let index = 0; index < rings; index += 1) {
    const ringY = y + 5 + index * Math.max(3, Math.floor(config.trunkHeight / Math.max(1, rings + 1)));
    const ringX = x + 1 + (index % Math.max(1, config.trunkWidth - 2));
    parts.push(pixelRect(ringX, ringY, Math.max(1, Math.min(3, config.trunkWidth - 2)), 1, index % 2 === 0 ? palette.trunkDark : palette.trunkLight, 0.64));
  }

  return parts.join("\n");
}

function renderBranches(config: TreeConfig, palette: Palette, random: () => number): string {
  if (config.growth === "seedling") return "";
  const ageBranchBonus = config.ageStage === "old_age" ? 2 : config.ageStage === "adult_age" ? 1 : 0;
  const count = config.health === "withered" ? 7 : config.health === "depleted" ? 6 : config.growth === "sapling" ? 2 : config.growth === "young" ? 3 : 4 + ageBranchBonus;
  const maxLength = config.health === "withered" ? 18 : config.health === "depleted" ? 15 : config.growth === "sapling" ? 5 : config.growth === "young" ? 8 : 13 + ageBranchBonus;
  const opacity = config.health === "withered" ? 0.78 : config.health === "depleted" ? 0.62 : 0.42;
  const originY = config.baseY - config.trunkHeight + Math.round(7 * config.crownScale);

  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const startY = originY + index * 3;
    const endX = config.baseX + side * Math.round(4 + random() * maxLength);
    const endY = startY - Math.round(2 + random() * 5);
    return `<line x1="${sx(config.baseX)}" y1="${sy(startY)}" x2="${sx(endX)}" y2="${sy(endY)}" stroke="${palette.branch}" stroke-width="${config.growth === "sapling" ? 2 : 3}" stroke-linecap="square" opacity="${opacity}"/>`;
  }).join("\n");
}

function renderBlocks(blocks: Block[]): string {
  return blocks.map((block) => pixelRect(block.x, block.y, block.w, block.h, block.color, block.opacity)).join("\n");
}

function pixelRect(x: number, y: number, w: number, h: number, color: string, opacity = 1): string {
  return `<rect x="${sx(x)}" y="${sy(y)}" width="${w * SIZE}" height="${h * SIZE}" fill="${color}" opacity="${opacity}"/>`;
}

function paletteFor(biome: PixelTreeBiome, health: HealthStage): Palette {
  if (health === "withered") return { bg: "#17231f", shadow: "#222a20", shadowDark: "#18180f", trunkDark: "#4a321d", trunk: "#7b5a33", trunkLight: "#a57a43", branch: "#5b3d22", leafBack: "#49492d", leafDark: "#3e3b24", leaf: "#6e6a3c", leafLight: "#9d9652", leafUnder: "#2e2f1d", edgeChip: "#4f4a2d" };
  if (health === "depleted") return { bg: "#17231f", shadow: "#243325", shadowDark: "#1c2117", trunkDark: "#56381f", trunk: "#87623a", trunkLight: "#b4894d", branch: "#654527", leafBack: "#515b32", leafDark: "#3d4f2c", leaf: "#74834b", leafLight: "#aaa45f", leafUnder: "#2f3d25", edgeChip: "#4e5931" };
  if (health === "stressed") return { bg: "#17231f", shadow: "#253b2b", shadowDark: "#192519", trunkDark: "#5c3b21", trunk: "#8d6236", trunkLight: "#b98646", branch: "#684527", leafBack: "#365331", leafDark: "#284b2a", leaf: "#608c45", leafLight: "#a5b963", leafUnder: "#203b24", edgeChip: "#2e522c" };
  if (biome === "desert") return { bg: "#17231f", shadow: "#2a3827", shadowDark: "#2f2519", trunkDark: "#6b4b2b", trunk: "#9b7445", trunkLight: "#c79a5e", branch: "#75512b", leafBack: "#5f6a38", leafDark: "#4b512d", leaf: "#8b934e", leafLight: "#c2c06c", leafUnder: "#384020", edgeChip: "#535f32" };
  if (biome === "oasis") return { bg: "#17231f", shadow: "#263f2f", shadowDark: "#163228", trunkDark: "#604028", trunk: "#936139", trunkLight: "#bf8953", branch: "#6e4a2d", leafBack: "#23604d", leafDark: "#1c634e", leaf: "#4b9d77", leafLight: "#8ed0a0", leafUnder: "#16483b", edgeChip: "#1b5a49" };
  if (biome === "forest") return { bg: "#17231f", shadow: "#263f2f", shadowDark: "#142319", trunkDark: "#5a351f", trunk: "#8a5a31", trunkLight: "#b87a3a", branch: "#6b4527", leafBack: "#1f5130", leafDark: "#154526", leaf: "#3f873d", leafLight: "#7ec35c", leafUnder: "#10351e", edgeChip: "#173f26" };
  return { bg: "#17231f", shadow: "#263f2f", shadowDark: "#1c2d1e", trunkDark: "#654022", trunk: "#9a6838", trunkLight: "#c98d4b", branch: "#784d2a", leafBack: "#2f6a37", leafDark: "#286333", leaf: "#5da34d", leafLight: "#a5d66e", leafUnder: "#1f4d28", edgeChip: "#275c31" };
}

function normalizeFact(fact: PixelTreeWorldFact): PixelTreeWorldFact {
  return { ...fact, growth: clamp(Math.round(fact.growth), 0, 100), health: clamp(Math.round(fact.health), 0, 100), moisture: clamp(Math.round(fact.moisture), 0, 100), age: clamp(Math.round(fact.age), 0, 300) };
}

function sx(x: number): number { return OX + x * SIZE; }
function sy(y: number): number { return OY + y * SIZE; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function escapeText(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function seededRandom(seed: string): () => number { let state = hash(seed); return () => { state += 0x6d2b79f5; let mixed = state; mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1); mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61); return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296; }; }
function hash(value: string): number { let current = 2166136261; for (let index = 0; index < value.length; index += 1) { current ^= value.charCodeAt(index); current = Math.imul(current, 16777619); } return current >>> 0; }
