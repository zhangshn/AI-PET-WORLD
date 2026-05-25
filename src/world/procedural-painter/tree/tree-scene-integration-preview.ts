// 该文件用于测试树作为世界对象时的接地、遮挡和场景融合规则。

import type { PixelTreeBiome, PixelTreeWorldFact } from "./tree-render-test-module";

type ScenePalette = {
  sky: string;
  groundA: string;
  groundB: string;
  groundC: string;
  path: string;
  shadow: string;
  grass: string;
  grassLight: string;
  trunkDark: string;
  trunk: string;
  trunkLight: string;
  branch: string;
  leafDark: string;
  leaf: string;
  leafLight: string;
  leafUnder: string;
  stone: string;
  stoneLight: string;
  pet: string;
  petDark: string;
};

type SceneTree = {
  id: string;
  x: number;
  y: number;
  scale: number;
  growth: number;
  health: number;
  age: number;
  frontGrass: boolean;
};

const PIXEL = 3;

export function buildTreeSceneIntegrationSvg(fact: PixelTreeWorldFact): string {
  const clean = normalizeFact(fact);
  const random = seededRandom(`${clean.worldSeed}:${clean.id}:scene-integration-v1`);
  const palette = paletteFor(clean.biome);
  const trees = buildSceneTrees(clean);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="360" viewBox="0 0 960 360" shape-rendering="crispEdges" role="img" aria-label="tree scene integration preview">`,
    `<rect x="0" y="0" width="960" height="360" fill="${palette.sky}"/>`,
    renderGroundTiles(palette, random),
    renderPath(palette),
    renderStones(palette, random),
    renderBackGrass(palette, random),
    trees.map((tree) => renderTreeShadow(tree, palette)).join("\n"),
    trees.map((tree) => renderTreeBackLayer(tree, clean.biome, palette, random)).join("\n"),
    renderPetPlaceholder(palette),
    trees.map((tree) => renderTreeFrontLayer(tree, palette, random)).join("\n"),
    renderFrontGroundGrass(palette, random),
    `<text x="24" y="32" font-size="14" fill="#d8ead8" font-family="monospace">scene fusion: tiles + y-sort + shadow + foregrass occlusion</text>`,
    `</svg>`,
  ].join("\n");
}

function buildSceneTrees(fact: PixelTreeWorldFact): SceneTree[] {
  return [
    {
      id: "back_tree",
      x: 260,
      y: 202,
      scale: 0.72,
      growth: clamp(fact.growth - 18, 12, 100),
      health: clamp(fact.health - 8, 0, 100),
      age: clamp(fact.age + 20, 0, 120),
      frontGrass: false,
    },
    {
      id: "main_tree",
      x: 492,
      y: 246,
      scale: 1,
      growth: fact.growth,
      health: fact.health,
      age: fact.age,
      frontGrass: true,
    },
    {
      id: "side_tree",
      x: 715,
      y: 224,
      scale: 0.84,
      growth: clamp(fact.growth + 8, 0, 100),
      health: clamp(fact.health - 22, 0, 100),
      age: clamp(fact.age + 46, 0, 120),
      frontGrass: true,
    },
  ];
}

function renderGroundTiles(p: ScenePalette, random: () => number): string {
  const parts: string[] = [];
  for (let y = 72; y < 360; y += 24) {
    for (let x = 0; x < 960; x += 24) {
      const color = random() > 0.55 ? p.groundA : random() > 0.5 ? p.groundB : p.groundC;
      parts.push(`<rect x="${x}" y="${y}" width="24" height="24" fill="${color}" opacity="0.96"/>`);
      if (random() > 0.7) {
        parts.push(`<rect x="${x + 6}" y="${y + 14}" width="6" height="3" fill="${p.groundC}" opacity="0.55"/>`);
      }
    }
  }
  return parts.join("\n");
}

function renderPath(p: ScenePalette): string {
  return [
    `<path d="M0 298 C180 264 302 294 430 268 C566 240 742 266 960 234 L960 360 L0 360 Z" fill="${p.path}" opacity="0.52"/>`,
    `<path d="M0 318 C196 286 322 310 452 286 C604 258 748 286 960 256" fill="none" stroke="${p.groundC}" stroke-width="6" opacity="0.42"/>`,
  ].join("\n");
}

function renderStones(p: ScenePalette, random: () => number): string {
  const anchors = [
    [128, 276],
    [356, 312],
    [610, 292],
    [828, 270],
  ];

  return anchors
    .map(([x, y]) => {
      const w = 12 + Math.round(random() * 9);
      return [`<rect x="${x}" y="${y}" width="${w}" height="6" fill="${p.stone}"/>`, `<rect x="${x + 3}" y="${y - 3}" width="${Math.max(3, w - 7)}" height="3" fill="${p.stoneLight}"/>`].join("\n");
    })
    .join("\n");
}

function renderBackGrass(p: ScenePalette, random: () => number): string {
  const parts: string[] = [];
  for (let index = 0; index < 90; index += 1) {
    const x = Math.round(random() * 930 + 15);
    const y = Math.round(106 + random() * 206);
    const h = Math.round(3 + random() * 10);
    const color = random() > 0.64 ? p.grassLight : p.grass;
    parts.push(`<rect x="${x}" y="${y - h}" width="3" height="${h}" fill="${color}" opacity="0.74"/>`);
  }
  return parts.join("\n");
}

function renderTreeShadow(tree: SceneTree, p: ScenePalette): string {
  const rx = Math.round((42 + tree.age * 0.16 + tree.growth * 0.12) * tree.scale);
  const ry = Math.round(12 * tree.scale);
  return `<ellipse cx="${tree.x}" cy="${tree.y + 4}" rx="${rx}" ry="${ry}" fill="${p.shadow}" opacity="0.46"/>`;
}

function renderTreeBackLayer(tree: SceneTree, biome: PixelTreeBiome, p: ScenePalette, random: () => number): string {
  const trunkHeight = Math.round((42 + tree.growth * 0.26 + tree.age * 0.04) * tree.scale);
  const crownScale = (0.72 + tree.growth * 0.006 + tree.age * 0.0008) * tree.scale;
  const crownY = tree.y - trunkHeight - Math.round(14 * tree.scale);
  const crownX = tree.x;
  const leafScale = biome === "grassland" ? 1.12 : biome === "desert" ? 0.72 : biome === "oasis" ? 1.08 : 1;
  const healthDensity = tree.health <= 8 ? 0.28 : tree.health <= 32 ? 0.48 : tree.health <= 62 ? 0.74 : 1;

  return [
    renderBranches(tree.x, tree.y - trunkHeight + 10 * tree.scale, trunkHeight, p, tree.health, random),
    renderLeafMass(crownX + Math.round(14 * crownScale), crownY + Math.round(2 * crownScale), [4, 10, 17, 24, 29, 29, 25, 18, 9], crownScale * leafScale * 0.96 * healthDensity, p.leafDark, random),
    renderLeafMass(crownX + Math.round(1 * crownScale), crownY, [5, 12, 20, 26, 29, 28, 23, 15, 7], crownScale * leafScale * healthDensity, p.leaf, random),
  ].join("\n");
}

function renderTreeFrontLayer(tree: SceneTree, p: ScenePalette, random: () => number): string {
  const trunkWidth = Math.round((5 + tree.growth * 0.045 + tree.age * 0.03) * tree.scale);
  const trunkHeight = Math.round((42 + tree.growth * 0.26 + tree.age * 0.04) * tree.scale);
  const trunkX = Math.round(tree.x - trunkWidth / 2);
  const trunkY = Math.round(tree.y - trunkHeight);
  const crownScale = (0.72 + tree.growth * 0.006 + tree.age * 0.0008) * tree.scale;
  const crownY = tree.y - trunkHeight - Math.round(14 * tree.scale);
  const healthDensity = tree.health <= 8 ? 0.28 : tree.health <= 32 ? 0.48 : tree.health <= 62 ? 0.74 : 1;
  const barkLines = Math.min(5, Math.floor(tree.age / 24));
  const parts: string[] = [
    `<rect x="${trunkX}" y="${trunkY}" width="${trunkWidth}" height="${trunkHeight}" fill="${p.trunkDark}"/>`,
    `<rect x="${trunkX + Math.max(1, Math.round(trunkWidth * 0.28))}" y="${trunkY + 3}" width="${Math.max(3, Math.round(trunkWidth * 0.58))}" height="${Math.max(6, trunkHeight - 6)}" fill="${p.trunk}"/>`,
    `<rect x="${trunkX + trunkWidth - 4}" y="${trunkY + 12}" width="3" height="${Math.round(trunkHeight * 0.52)}" fill="${p.trunkLight}"/>`,
    renderLeafMass(tree.x - Math.round(18 * crownScale), crownY + Math.round(4 * crownScale), [3, 9, 16, 22, 25, 22, 15, 7], crownScale * 0.88 * healthDensity, p.leaf, random),
    renderLeafMass(tree.x - Math.round(10 * crownScale), crownY - Math.round(8 * crownScale), [2, 6, 11, 14, 13, 8, 3], crownScale * 0.72 * healthDensity, p.leafLight, random),
    renderLeafMass(tree.x + Math.round(2 * crownScale), crownY + Math.round(14 * crownScale), [5, 12, 20, 24, 20, 11], crownScale * 0.86 * healthDensity, p.leafUnder, random),
  ];

  for (let index = 0; index < barkLines; index += 1) {
    parts.push(`<rect x="${trunkX + 3 + (index % Math.max(1, trunkWidth - 7))}" y="${trunkY + 8 + index * 7}" width="${Math.max(3, Math.round(trunkWidth * 0.42))}" height="3" fill="${index % 2 === 0 ? p.trunkDark : p.trunkLight}" opacity="0.58"/>`);
  }

  if (tree.frontGrass) {
    parts.push(renderAnchorGrass(tree.x, tree.y, p, random));
  }

  return parts.join("\n");
}

function renderBranches(x: number, y: number, trunkHeight: number, p: ScenePalette, health: number, random: () => number): string {
  const count = health <= 32 ? 6 : 4;
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const startY = Math.round(y + index * trunkHeight * 0.12);
    const endX = Math.round(x + side * (22 + random() * 22));
    const endY = Math.round(startY - 10 - random() * 18);
    return `<line x1="${x}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${p.branch}" stroke-width="${PIXEL}" stroke-linecap="square" opacity="${health <= 32 ? 0.72 : 0.38}"/>`;
  }).join("\n");
}

function renderLeafMass(cx: number, cy: number, rows: number[], scale: number, color: string, random: () => number): string {
  const step = Math.max(3, Math.round(PIXEL * scale * 0.9));
  const topY = Math.round(cy - (rows.length * step) / 2);

  return rows
    .map((row, index) => {
      const width = Math.max(6, Math.round(row * PIXEL * scale));
      const x = Math.round(cx - width / 2 + (random() - 0.5) * 6);
      const y = topY + index * step;
      return `<rect x="${x}" y="${y}" width="${width}" height="${step}" fill="${color}"/>`;
    })
    .join("\n");
}

function renderAnchorGrass(x: number, y: number, p: ScenePalette, random: () => number): string {
  const parts: string[] = [];
  for (let index = 0; index < 18; index += 1) {
    const gx = Math.round(x - 34 + random() * 68);
    const h = Math.round(6 + random() * 16);
    const color = random() > 0.58 ? p.grassLight : p.grass;
    parts.push(`<rect x="${gx}" y="${y - h + Math.round(random() * 8)}" width="3" height="${h}" fill="${color}"/>`);
  }
  return parts.join("\n");
}

function renderPetPlaceholder(p: ScenePalette): string {
  return [
    `<ellipse cx="548" cy="264" rx="18" ry="9" fill="${p.shadow}" opacity="0.42"/>`,
    `<rect x="532" y="242" width="27" height="18" fill="${p.petDark}"/>`,
    `<rect x="538" y="236" width="24" height="21" fill="${p.pet}"/>`,
    `<rect x="560" y="242" width="9" height="9" fill="${p.pet}"/>`,
    `<rect x="542" y="242" width="3" height="3" fill="#102119"/>`,
  ].join("\n");
}

function renderFrontGroundGrass(p: ScenePalette, random: () => number): string {
  const parts: string[] = [];
  for (let index = 0; index < 44; index += 1) {
    const x = Math.round(random() * 930 + 15);
    const y = Math.round(300 + random() * 44);
    const h = Math.round(4 + random() * 14);
    parts.push(`<rect x="${x}" y="${y - h}" width="3" height="${h}" fill="${random() > 0.6 ? p.grassLight : p.grass}"/>`);
  }
  return parts.join("\n");
}

function paletteFor(biome: PixelTreeBiome): ScenePalette {
  if (biome === "desert") {
    return {
      sky: "#17231f",
      groundA: "#293224",
      groundB: "#302b20",
      groundC: "#40351f",
      path: "#5c5130",
      shadow: "#121911",
      grass: "#797a3f",
      grassLight: "#b0a85c",
      trunkDark: "#6b4b2b",
      trunk: "#9b7445",
      trunkLight: "#c79a5e",
      branch: "#75512b",
      leafDark: "#4b512d",
      leaf: "#8b934e",
      leafLight: "#c2c06c",
      leafUnder: "#384020",
      stone: "#6a6245",
      stoneLight: "#9a8f62",
      pet: "#a87b54",
      petDark: "#604131",
    };
  }

  if (biome === "oasis") {
    return {
      sky: "#17231f",
      groundA: "#213a2f",
      groundB: "#254839",
      groundC: "#183328",
      path: "#2e5141",
      shadow: "#102019",
      grass: "#54ad77",
      grassLight: "#91d7a1",
      trunkDark: "#604028",
      trunk: "#936139",
      trunkLight: "#bf8953",
      branch: "#6e4a2d",
      leafDark: "#1c634e",
      leaf: "#4b9d77",
      leafLight: "#8ed0a0",
      leafUnder: "#16483b",
      stone: "#48665d",
      stoneLight: "#78a090",
      pet: "#95c7b0",
      petDark: "#426a5c",
    };
  }

  return {
    sky: "#17231f",
    groundA: "#213528",
    groundB: "#263f2f",
    groundC: "#1a2a21",
    path: "#30492f",
    shadow: "#111b15",
    grass: "#3f7d3c",
    grassLight: "#7ab85c",
    trunkDark: "#5a351f",
    trunk: "#8a5a31",
    trunkLight: "#b87a3a",
    branch: "#6b4527",
    leafDark: "#154526",
    leaf: "#3f873d",
    leafLight: "#7ec35c",
    leafUnder: "#10351e",
    stone: "#536354",
    stoneLight: "#81927d",
    pet: "#b89260",
    petDark: "#6c4930",
  };
}

function normalizeFact(fact: PixelTreeWorldFact): PixelTreeWorldFact {
  return {
    ...fact,
    growth: clamp(Math.round(fact.growth), 0, 100),
    health: clamp(Math.round(fact.health), 0, 100),
    moisture: clamp(Math.round(fact.moisture), 0, 100),
    age: clamp(Math.round(fact.age), 0, 120),
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
