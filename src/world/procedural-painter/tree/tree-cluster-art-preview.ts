// 该文件用于测试像素树的 mask、zone 与 cluster 生成逻辑。

import type { PixelTreeBiome, PixelTreeWorldFact } from "./tree-render-test-module";

type Palette = {
  bg: string;
  ground: string;
  groundDark: string;
  trunkDark: string;
  trunk: string;
  trunkLight: string;
  leafEdge: string;
  leafDark: string;
  leaf: string;
  leafLight: string;
  leafUnder: string;
  grass: string;
  grassLight: string;
};

type Cell = {
  x: number;
  y: number;
  color: string;
};

const SIZE = 3;
const OX = 16;
const OY = 18;

export function buildPixelClusterTreeSvg(fact: PixelTreeWorldFact): string {
  const clean = normalizeFact(fact);
  const random = seededRandom(`${clean.worldSeed}:${clean.id}:cluster-tree-v1`);
  const palette = paletteFor(clean.biome);
  const growth = clean.growth / 100;
  const moisture = clean.moisture / 100;
  const baseX = 48;
  const baseY = 82;
  const trunkHeight = Math.round(21 + growth * 18);
  const trunkWidth = Math.round(5 + growth * 5);
  const crownWidth = Math.round(42 + growth * 20 + moisture * 8 + (clean.biome === "grassland" ? 8 : 0));
  const crownHeight = Math.round(29 + growth * 12 + moisture * 5 + (clean.biome === "forest" ? 4 : 0));
  const crownX = baseX;
  const crownY = baseY - trunkHeight - Math.round(crownHeight * 0.18);
  const mask = buildMask(crownX, crownY, crownWidth, crownHeight);
  const cells = paintMask(mask, crownX, crownY, crownWidth, crownHeight, palette, random);

  addClusterCells(cells, mask, crownX, crownY, crownWidth, crownHeight, palette, random, "light", 18);
  addClusterCells(cells, mask, crownX, crownY, crownWidth, crownHeight, palette, random, "shadow", 22);
  addClusterCells(cells, mask, crownX, crownY, crownWidth, crownHeight, palette, random, "under", 12);
  addClusterCells(cells, mask, crownX, crownY, crownWidth, crownHeight, palette, random, "edge", 18);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" shape-rendering="crispEdges" role="img" aria-label="pixel cluster tree preview">`,
    `<rect x="0" y="0" width="320" height="320" fill="${palette.bg}"/>`,
    `<text x="16" y="28" font-size="12" fill="#d8ead8" font-family="monospace">${escapeText(`${clean.biome} cluster g${clean.growth} h${clean.health} m${clean.moisture}`)}</text>`,
    groundSvg(baseX, baseY, crownWidth, trunkWidth, palette, clean, random),
    trunkSvg(baseX, baseY, trunkWidth, trunkHeight, palette),
    branchSvg(baseX, baseY, trunkHeight, palette, random),
    cells.map((cell) => rect(cell.x, cell.y, cell.color)).join("\n"),
    frontGrassSvg(baseX, baseY, trunkWidth, palette, clean, random),
    `</svg>`,
  ].join("\n");
}

function buildMask(cx: number, cy: number, w: number, h: number): Set<string> {
  const mask = new Set<string>();
  const lobes = [
    [-0.26, 0.08, 0.36, 0.34],
    [0.16, -0.12, 0.43, 0.34],
    [0.34, 0.1, 0.32, 0.29],
    [-0.08, 0.24, 0.34, 0.25],
    [-0.1, -0.28, 0.28, 0.2],
  ];

  for (let y = 8; y < 88; y += 1) {
    for (let x = 8; x < 88; x += 1) {
      const nx = (x - cx) / w;
      const ny = (y - cy) / h;
      const inside = lobes.some(([lx, ly, rx, ry]) => {
        const dx = nx - lx;
        const dy = ny - ly;
        const noise = noiseAt(x, y) * 0.16 - 0.06;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1 + noise;
      });
      if (inside) mask.add(key(x, y));
    }
  }

  return mask;
}

function paintMask(mask: Set<string>, cx: number, cy: number, w: number, h: number, p: Palette, random: () => number): Cell[] {
  const cells: Cell[] = [];
  for (const item of mask) {
    const [x, y] = item.split(":").map(Number);
    const edge = isEdge(x, y, mask);
    if (edge && random() < 0.18) continue;
    const nx = (x - cx) / w;
    const ny = (y - cy) / h;
    const color = edge ? p.leafEdge : ny > 0.18 ? p.leafUnder : nx < -0.14 && ny < -0.08 ? p.leafLight : nx > 0.18 || ny > 0.1 ? p.leafDark : p.leaf;
    cells.push({ x, y, color });
  }
  return cells;
}

function addClusterCells(cells: Cell[], mask: Set<string>, cx: number, cy: number, w: number, h: number, p: Palette, random: () => number, role: "light" | "shadow" | "under" | "edge", count: number): void {
  const templates = [
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ];
  for (let placed = 0, tries = 0; placed < count && tries < count * 30; tries += 1) {
    const x = Math.round(cx + (random() - 0.5) * w * 1.05);
    const y = Math.round(cy + (random() - 0.48) * h * 0.8);
    if (!mask.has(key(x, y))) continue;
    const score = zoneScore(x, y, cx, cy, w, h, mask, role);
    if (score < 0.62) continue;
    const template = templates[Math.floor(random() * templates.length)] ?? templates[0];
    const color = role === "light" ? p.leafLight : role === "under" ? p.leafUnder : role === "edge" ? p.leafEdge : p.leafDark;
    for (const [dx, dy] of template) {
      if (mask.has(key(x + dx, y + dy))) cells.push({ x: x + dx, y: y + dy, color });
    }
    placed += 1;
  }
}

function zoneScore(x: number, y: number, cx: number, cy: number, w: number, h: number, mask: Set<string>, role: string): number {
  const nx = (x - cx) / w;
  const ny = (y - cy) / h;
  if (role === "light") return clamp01(0.74 - nx * 0.9 - ny * 0.85);
  if (role === "shadow") return clamp01(0.36 + nx * 0.68 + ny * 0.72);
  if (role === "under") return clamp01((ny - 0.08) * 3);
  return isEdge(x, y, mask) ? 0.95 : 0.25;
}

function trunkSvg(baseX: number, baseY: number, tw: number, th: number, p: Palette): string {
  const x = baseX - Math.round(tw / 2);
  const y = baseY - th;
  return [
    `<rect x="${sx(x)}" y="${sy(y)}" width="${tw * SIZE}" height="${th * SIZE}" fill="${p.trunkDark}"/>`,
    `<rect x="${sx(x + 2)}" y="${sy(y + 1)}" width="${Math.max(2, tw - 4) * SIZE}" height="${(th - 2) * SIZE}" fill="${p.trunk}"/>`,
    `<rect x="${sx(x + tw - 2)}" y="${sy(y + 5)}" width="${SIZE}" height="${Math.round(th * 0.58) * SIZE}" fill="${p.trunkLight}"/>`,
  ].join("\n");
}

function branchSvg(baseX: number, baseY: number, th: number, p: Palette, random: () => number): string {
  const parts: string[] = [];
  const y = baseY - th + 5;
  for (let i = 0; i < 4; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    parts.push(`<line x1="${sx(baseX)}" y1="${sy(y + i * 4)}" x2="${sx(baseX + side * Math.round(8 + random() * 10))}" y2="${sy(y + i * 3 - Math.round(5 + random() * 8))}" stroke="${p.trunkDark}" stroke-width="4" stroke-linecap="square" opacity="0.72"/>`);
  }
  return parts.join("\n");
}

function groundSvg(baseX: number, baseY: number, cw: number, tw: number, p: Palette, fact: PixelTreeWorldFact, random: () => number): string {
  const parts = [
    `<ellipse cx="160" cy="266" rx="108" ry="26" fill="${p.ground}" opacity="0.82"/>`,
    `<ellipse cx="${sx(baseX + 2)}" cy="${sy(baseY + 3)}" rx="${Math.round(cw * 1.1)}" ry="15" fill="${p.groundDark}" opacity="0.32"/>`,
  ];
  const count = fact.biome === "desert" ? 10 : 18;
  for (let i = 0; i < count; i += 1) parts.push(`<rect x="${sx(baseX + Math.round((random() - 0.5) * tw * 7))}" y="${sy(baseY + Math.round(random() * 10))}" width="${SIZE}" height="${SIZE}" fill="${random() > 0.55 ? p.grass : p.groundDark}" opacity="0.78"/>`);
  return parts.join("\n");
}

function frontGrassSvg(baseX: number, baseY: number, tw: number, p: Palette, fact: PixelTreeWorldFact, random: () => number): string {
  const parts: string[] = [];
  const count = fact.biome === "desert" ? 9 : fact.biome === "oasis" ? 28 : 20;
  for (let i = 0; i < count; i += 1) {
    const h = Math.round(2 + random() * (fact.biome === "desert" ? 3 : 6));
    parts.push(`<rect x="${sx(baseX + Math.round((random() - 0.5) * tw * 7))}" y="${sy(baseY + Math.round((random() - 0.12) * 8) - h)}" width="${SIZE}" height="${h * SIZE}" fill="${random() > 0.62 ? p.grassLight : p.grass}"/>`);
  }
  return parts.join("\n");
}

function rect(x: number, y: number, color: string): string {
  return `<rect x="${sx(x)}" y="${sy(y)}" width="${SIZE}" height="${SIZE}" fill="${color}"/>`;
}

function paletteFor(biome: PixelTreeBiome): Palette {
  if (biome === "desert") return { bg: "#17231f", ground: "#2a3827", groundDark: "#2f2519", trunkDark: "#6b4b2b", trunk: "#9b7445", trunkLight: "#c79a5e", leafEdge: "#535f32", leafDark: "#5f6a38", leaf: "#8b934e", leafLight: "#c2c06c", leafUnder: "#4b512d", grass: "#8b8c4d", grassLight: "#b4aa63" };
  if (biome === "oasis") return { bg: "#17231f", ground: "#263f2f", groundDark: "#163228", trunkDark: "#604028", trunk: "#936139", trunkLight: "#bf8953", leafEdge: "#1b5a49", leafDark: "#23604d", leaf: "#4b9d77", leafLight: "#8ed0a0", leafUnder: "#1c634e", grass: "#54ad77", grassLight: "#91d7a1" };
  if (biome === "forest") return { bg: "#17231f", ground: "#263f2f", groundDark: "#142319", trunkDark: "#5a351f", trunk: "#8a5a31", trunkLight: "#b87a3a", leafEdge: "#173f26", leafDark: "#1f5130", leaf: "#3f873d", leafLight: "#7ec35c", leafUnder: "#154526", grass: "#3f7d3c", grassLight: "#7ab85c" };
  return { bg: "#17231f", ground: "#263f2f", groundDark: "#1c2d1e", trunkDark: "#654022", trunk: "#9a6838", trunkLight: "#c98d4b", leafEdge: "#275c31", leafDark: "#2f6a37", leaf: "#5da34d", leafLight: "#a5d66e", leafUnder: "#286333", grass: "#5a9b45", grassLight: "#9fd36a" };
}

function normalizeFact(fact: PixelTreeWorldFact): PixelTreeWorldFact {
  return { ...fact, growth: clamp(Math.round(fact.growth), 0, 100), health: clamp(Math.round(fact.health), 0, 100), moisture: clamp(Math.round(fact.moisture), 0, 100), age: clamp(Math.round(fact.age), 0, 300) };
}

function isEdge(x: number, y: number, mask: Set<string>): boolean {
  return !mask.has(key(x - 1, y)) || !mask.has(key(x + 1, y)) || !mask.has(key(x, y - 1)) || !mask.has(key(x, y + 1));
}

function key(x: number, y: number): string { return `${x}:${y}`; }
function sx(x: number): number { return OX + x * SIZE; }
function sy(y: number): number { return OY + y * SIZE; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function clamp01(value: number): number { return clamp(value, 0, 1); }
function noiseAt(x: number, y: number): number { return (((Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263)) >>> 0) % 997) / 997; }
function escapeText(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function seededRandom(seed: string): () => number { let state = hash(seed); return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(value: string): number { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
