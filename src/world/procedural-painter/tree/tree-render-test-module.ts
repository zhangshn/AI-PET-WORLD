// 该文件定义程序化树木绘制测试模块。

export type PixelTreeBiome = "forest" | "grassland" | "desert" | "oasis";

export type PixelTreeGrowthStage = "young" | "growing" | "mature" | "old";
export type PixelTreeHealthState = "weak" | "normal" | "healthy";
export type PixelTreeMoistureState = "dry" | "balanced" | "wet";
export type PixelTreeTone = "dark" | "main" | "light";

export type PixelTreeWorldFact = {
  id: string;
  worldSeed: string;
  x: number;
  y: number;
  biome: PixelTreeBiome;
  age: number;
  growth: number;
  health: number;
  moisture: number;
};

export type PixelTreePerception = {
  growthStage: PixelTreeGrowthStage;
  healthState: PixelTreeHealthState;
  moistureState: PixelTreeMoistureState;
  shouldBeTall: boolean;
  shouldBeDense: boolean;
  shouldLookDry: boolean;
  visualMood: "dense" | "fresh" | "soft" | "dry";
};

export type PixelTreePalette = {
  trunkDark: string;
  trunkMain: string;
  trunkLight: string;
  leafDark: string;
  leafMain: string;
  leafLight: string;
  shadow: string;
};

export type PixelTreeVisualDecision = {
  speciesStyle: "round_broadleaf" | "open_grassland" | "dry_sparse" | "oasis_soft";
  trunkHeight: number;
  trunkWidth: number;
  crownWidth: number;
  crownHeight: number;
  crownDensity: number;
  branchCount: number;
  leafPixelCount: number;
  trunkLean: number;
  palette: PixelTreePalette;
};

export type PixelTreeBranchPlan = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  tone: "trunkDark" | "trunkMain" | "trunkLight";
};

export type PixelTreeCrownBlobPlan = {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  tone: PixelTreeTone;
};

export type PixelTreeLeafPixelPlan = {
  x: number;
  y: number;
  size: number;
  tone: PixelTreeTone;
};

export type PixelTreeStructurePlan = {
  id: string;
  anchor: {
    x: number;
    y: number;
  };
  shadow: {
    x: number;
    y: number;
    radiusX: number;
    radiusY: number;
    opacity: number;
  };
  trunk: {
    x: number;
    y: number;
    width: number;
    height: number;
    lean: number;
  };
  branches: PixelTreeBranchPlan[];
  crownBlobs: PixelTreeCrownBlobPlan[];
  leafPixels: PixelTreeLeafPixelPlan[];
};

export type PixelTreeDrawCommand =
  | {
      type: "pixelEllipse";
      layer: "shadow" | "leaf";
      x: number;
      y: number;
      radiusX: number;
      radiusY: number;
      color: string;
      opacity: number;
    }
  | {
      type: "pixelRect";
      layer: "trunk" | "leaf";
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      opacity: number;
    }
  | {
      type: "pixelLine";
      layer: "branch";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      color: string;
      opacity: number;
    };

export type PixelTreeRenderTestResult = {
  fact: PixelTreeWorldFact;
  perception: PixelTreePerception;
  decision: PixelTreeVisualDecision;
  structure: PixelTreeStructurePlan;
  commands: PixelTreeDrawCommand[];
  audit: {
    module: "pixel_tree_render_test";
    writesHomeMapState: false;
    usesExternalImageAi: false;
    usesImageAsset: false;
    deterministic: true;
    tags: string[];
  };
};

const DEFAULT_TREE_FACT: PixelTreeWorldFact = {
  id: "tree_test_001",
  worldSeed: "ai_pet_world_tree_test_seed_001",
  x: 160,
  y: 250,
  biome: "forest",
  age: 28,
  growth: 82,
  health: 88,
  moisture: 72,
};

const BIOME_SCALE: Record<PixelTreeBiome, number> = {
  forest: 1.24,
  grassland: 1,
  desert: 0.68,
  oasis: 1.12,
};

const BIOME_PALETTE: Record<PixelTreeBiome, PixelTreePalette> = {
  forest: {
    trunkDark: "#5a351f",
    trunkMain: "#8a5a31",
    trunkLight: "#b87a3a",
    leafDark: "#1f5130",
    leafMain: "#3f873d",
    leafLight: "#7ec35c",
    shadow: "#17231b",
  },
  grassland: {
    trunkDark: "#654022",
    trunkMain: "#9a6838",
    trunkLight: "#c98d4b",
    leafDark: "#2f6a37",
    leafMain: "#5da34d",
    leafLight: "#a5d66e",
    shadow: "#1f2d1e",
  },
  desert: {
    trunkDark: "#6b4b2b",
    trunkMain: "#9b7445",
    trunkLight: "#c79a5e",
    leafDark: "#5f6a38",
    leafMain: "#8b934e",
    leafLight: "#c2c06c",
    shadow: "#2f2519",
  },
  oasis: {
    trunkDark: "#604028",
    trunkMain: "#936139",
    trunkLight: "#bf8953",
    leafDark: "#23604d",
    leafMain: "#4b9d77",
    leafLight: "#8ed0a0",
    shadow: "#18302b",
  },
};

export function buildDefaultPixelTreeFact(
  overrides: Partial<PixelTreeWorldFact> = {},
): PixelTreeWorldFact {
  return normalizeTreeFact({
    ...DEFAULT_TREE_FACT,
    ...overrides,
  });
}

export function buildPixelTreeBiomeSamples(): PixelTreeWorldFact[] {
  return [
    buildDefaultPixelTreeFact({ id: "tree_forest_sample", biome: "forest", x: 120, y: 250 }),
    buildDefaultPixelTreeFact({ id: "tree_grassland_sample", biome: "grassland", x: 280, y: 250 }),
    buildDefaultPixelTreeFact({ id: "tree_desert_sample", biome: "desert", x: 440, y: 250, moisture: 24, health: 56, growth: 58 }),
    buildDefaultPixelTreeFact({ id: "tree_oasis_sample", biome: "oasis", x: 600, y: 250, moisture: 92, health: 82, growth: 74 }),
  ];
}

export function runPixelTreeRenderTest(
  input: PixelTreeWorldFact,
): PixelTreeRenderTestResult {
  const fact = normalizeTreeFact(input);
  const perception = perceivePixelTree(fact);
  const decision = decidePixelTreeVisual(fact, perception);
  const structure = buildPixelTreeStructure(fact, decision);
  const commands = buildPixelTreeDrawCommands(structure, decision);

  return {
    fact,
    perception,
    decision,
    structure,
    commands,
    audit: {
      module: "pixel_tree_render_test",
      writesHomeMapState: false,
      usesExternalImageAi: false,
      usesImageAsset: false,
      deterministic: true,
      tags: [
        "procedural_painter_test",
        "tree_rule_engine_test",
        "read_only_visual_projection",
        "no_home_map_state_write",
        "no_external_image_ai",
        "no_texture_asset",
      ],
    },
  };
}

export function perceivePixelTree(fact: PixelTreeWorldFact): PixelTreePerception {
  const growthStage: PixelTreeGrowthStage =
    fact.growth < 28 ? "young" : fact.growth < 62 ? "growing" : fact.growth < 90 ? "mature" : "old";

  const healthState: PixelTreeHealthState =
    fact.health < 42 ? "weak" : fact.health < 74 ? "normal" : "healthy";

  const moistureState: PixelTreeMoistureState =
    fact.moisture < 35 ? "dry" : fact.moisture < 72 ? "balanced" : "wet";

  return {
    growthStage,
    healthState,
    moistureState,
    shouldBeTall: fact.growth >= 68 && fact.biome !== "desert",
    shouldBeDense: fact.health >= 70 && fact.moisture >= 58 && fact.biome !== "desert",
    shouldLookDry: fact.moisture < 36 || fact.biome === "desert",
    visualMood: decideVisualMood(fact),
  };
}

export function decidePixelTreeVisual(
  fact: PixelTreeWorldFact,
  perception: PixelTreePerception,
): PixelTreeVisualDecision {
  const random = createSeededRandom(`${fact.worldSeed}:${fact.id}:visual`);
  const growthRate = fact.growth / 100;
  const healthRate = fact.health / 100;
  const moistureRate = fact.moisture / 100;
  const biomeScale = BIOME_SCALE[fact.biome];
  const dryness = 1 - moistureRate;
  const palette = BIOME_PALETTE[fact.biome];

  const trunkHeight = Math.round((34 + 58 * growthRate) * biomeScale);
  const trunkWidth = Math.round((10 + 14 * growthRate + fact.age * 0.08) * (fact.biome === "desert" ? 0.78 : 1));
  const crownWidth = Math.round((72 + 92 * growthRate + 24 * moistureRate) * biomeScale);
  const crownHeight = Math.round((54 + 68 * growthRate + 18 * healthRate) * biomeScale);
  const crownDensity = clamp(Math.round(28 + healthRate * 45 + moistureRate * 32 - dryness * 18), 18, 100);
  const branchCount = clamp(Math.round(2 + growthRate * 5 + dryness * 3), 2, 8);
  const leafPixelCount = clamp(Math.round(crownDensity * 1.3), 18, 140);
  const trunkLean = Math.round((random() - 0.5) * (fact.biome === "desert" ? 10 : 5));

  return {
    speciesStyle: decideSpeciesStyle(fact.biome),
    trunkHeight,
    trunkWidth,
    crownWidth: perception.shouldLookDry ? Math.round(crownWidth * 0.74) : crownWidth,
    crownHeight: perception.shouldLookDry ? Math.round(crownHeight * 0.74) : crownHeight,
    crownDensity,
    branchCount,
    leafPixelCount,
    trunkLean,
    palette,
  };
}

export function buildPixelTreeStructure(
  fact: PixelTreeWorldFact,
  decision: PixelTreeVisualDecision,
): PixelTreeStructurePlan {
  const random = createSeededRandom(`${fact.worldSeed}:${fact.id}:structure`);
  const crownCenterX = fact.x + decision.trunkLean;
  const crownCenterY = fact.y - decision.trunkHeight;
  const trunkTopX = fact.x + decision.trunkLean;
  const trunkTopY = fact.y - decision.trunkHeight;

  return {
    id: fact.id,
    anchor: { x: fact.x, y: fact.y },
    shadow: {
      x: fact.x + 2,
      y: fact.y + 7,
      radiusX: Math.round(decision.crownWidth * 0.42),
      radiusY: Math.round(decision.crownHeight * 0.13),
      opacity: fact.biome === "desert" ? 0.16 : 0.22,
    },
    trunk: {
      x: fact.x - decision.trunkWidth / 2,
      y: fact.y - decision.trunkHeight,
      width: decision.trunkWidth,
      height: decision.trunkHeight,
      lean: decision.trunkLean,
    },
    branches: buildBranchPlans(random, trunkTopX, trunkTopY, decision),
    crownBlobs: buildCrownBlobPlans(random, crownCenterX, crownCenterY, decision),
    leafPixels: buildLeafPixelPlans(random, crownCenterX, crownCenterY, decision),
  };
}

export function buildPixelTreeDrawCommands(
  structure: PixelTreeStructurePlan,
  decision: PixelTreeVisualDecision,
): PixelTreeDrawCommand[] {
  const commands: PixelTreeDrawCommand[] = [];

  commands.push({
    type: "pixelEllipse",
    layer: "shadow",
    x: structure.shadow.x,
    y: structure.shadow.y,
    radiusX: structure.shadow.radiusX,
    radiusY: structure.shadow.radiusY,
    color: decision.palette.shadow,
    opacity: structure.shadow.opacity,
  });

  commands.push({
    type: "pixelRect",
    layer: "trunk",
    x: structure.trunk.x + structure.trunk.lean,
    y: structure.trunk.y,
    width: structure.trunk.width,
    height: structure.trunk.height,
    color: decision.palette.trunkDark,
    opacity: 1,
  });

  commands.push({
    type: "pixelRect",
    layer: "trunk",
    x: structure.trunk.x + structure.trunk.lean + Math.max(2, Math.round(structure.trunk.width * 0.18)),
    y: structure.trunk.y + 2,
    width: Math.max(3, Math.round(structure.trunk.width * 0.56)),
    height: Math.max(4, structure.trunk.height - 4),
    color: decision.palette.trunkMain,
    opacity: 1,
  });

  commands.push({
    type: "pixelRect",
    layer: "trunk",
    x: structure.trunk.x + structure.trunk.lean + Math.max(3, Math.round(structure.trunk.width * 0.62)),
    y: structure.trunk.y + 6,
    width: Math.max(2, Math.round(structure.trunk.width * 0.18)),
    height: Math.max(4, Math.round(structure.trunk.height * 0.55)),
    color: decision.palette.trunkLight,
    opacity: 0.72,
  });

  for (const branch of structure.branches) {
    commands.push({
      type: "pixelLine",
      layer: "branch",
      x1: branch.startX,
      y1: branch.startY,
      x2: branch.endX,
      y2: branch.endY,
      width: branch.width,
      color: decision.palette[branch.tone],
      opacity: 0.9,
    });
  }

  for (const blob of structure.crownBlobs) {
    commands.push({
      type: "pixelEllipse",
      layer: "leaf",
      x: blob.x,
      y: blob.y,
      radiusX: blob.radiusX,
      radiusY: blob.radiusY,
      color: resolveLeafColor(decision.palette, blob.tone),
      opacity: 1,
    });
  }

  for (const leaf of structure.leafPixels) {
    commands.push({
      type: "pixelRect",
      layer: "leaf",
      x: leaf.x,
      y: leaf.y,
      width: leaf.size,
      height: leaf.size,
      color: resolveLeafColor(decision.palette, leaf.tone),
      opacity: leaf.tone === "light" ? 0.9 : 1,
    });
  }

  return commands;
}

export function paintPixelTreeCommandsToCanvas(
  context: CanvasRenderingContext2D,
  commands: PixelTreeDrawCommand[],
): void {
  for (const command of commands) {
    context.globalAlpha = command.opacity;

    if (command.type === "pixelRect") {
      context.fillStyle = command.color;
      context.fillRect(
        Math.round(command.x),
        Math.round(command.y),
        Math.round(command.width),
        Math.round(command.height),
      );
    }

    if (command.type === "pixelEllipse") {
      context.fillStyle = command.color;
      context.beginPath();
      context.ellipse(
        Math.round(command.x),
        Math.round(command.y),
        Math.round(command.radiusX),
        Math.round(command.radiusY),
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    if (command.type === "pixelLine") {
      context.strokeStyle = command.color;
      context.lineWidth = Math.max(1, Math.round(command.width));
      context.lineCap = "square";
      context.beginPath();
      context.moveTo(Math.round(command.x1), Math.round(command.y1));
      context.lineTo(Math.round(command.x2), Math.round(command.y2));
      context.stroke();
    }

    context.globalAlpha = 1;
  }
}

function normalizeTreeFact(fact: PixelTreeWorldFact): PixelTreeWorldFact {
  return {
    ...fact,
    x: Math.round(fact.x),
    y: Math.round(fact.y),
    age: clamp(Math.round(fact.age), 0, 300),
    growth: clamp(Math.round(fact.growth), 0, 100),
    health: clamp(Math.round(fact.health), 0, 100),
    moisture: clamp(Math.round(fact.moisture), 0, 100),
  };
}

function decideVisualMood(fact: PixelTreeWorldFact): PixelTreePerception["visualMood"] {
  if (fact.biome === "desert" || fact.moisture < 35) {
    return "dry";
  }

  if (fact.biome === "forest") {
    return "dense";
  }

  if (fact.biome === "oasis" || fact.moisture >= 74) {
    return "fresh";
  }

  return "soft";
}

function decideSpeciesStyle(biome: PixelTreeBiome): PixelTreeVisualDecision["speciesStyle"] {
  if (biome === "forest") {
    return "round_broadleaf";
  }

  if (biome === "desert") {
    return "dry_sparse";
  }

  if (biome === "oasis") {
    return "oasis_soft";
  }

  return "open_grassland";
}

function buildBranchPlans(
  random: () => number,
  trunkTopX: number,
  trunkTopY: number,
  decision: PixelTreeVisualDecision,
): PixelTreeBranchPlan[] {
  const branches: PixelTreeBranchPlan[] = [];

  for (let index = 0; index < decision.branchCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const verticalOffset = Math.round((index / Math.max(1, decision.branchCount - 1)) * decision.trunkHeight * 0.46);
    const length = Math.round(decision.crownWidth * (0.16 + random() * 0.18));
    const lift = Math.round(decision.crownHeight * (0.12 + random() * 0.22));
    const startX = trunkTopX + side * Math.round(random() * 4);
    const startY = trunkTopY + verticalOffset;

    branches.push({
      startX,
      startY,
      endX: startX + side * length,
      endY: startY - lift,
      width: Math.max(2, Math.round(decision.trunkWidth * (0.12 + random() * 0.12))),
      tone: random() > 0.74 ? "trunkLight" : "trunkMain",
    });
  }

  return branches;
}

function buildCrownBlobPlans(
  random: () => number,
  crownCenterX: number,
  crownCenterY: number,
  decision: PixelTreeVisualDecision,
): PixelTreeCrownBlobPlan[] {
  const baseBlobCount = decision.speciesStyle === "dry_sparse" ? 4 : 7;
  const blobCount = clamp(Math.round(baseBlobCount + decision.crownDensity / 24), 4, 11);
  const blobs: PixelTreeCrownBlobPlan[] = [];

  for (let index = 0; index < blobCount; index += 1) {
    const angle = (Math.PI * 2 * index) / blobCount + random() * 0.35;
    const distanceX = decision.crownWidth * (0.08 + random() * 0.28);
    const distanceY = decision.crownHeight * (0.06 + random() * 0.22);
    const tone: PixelTreeTone = index < 2 ? "dark" : index % 4 === 0 ? "light" : "main";

    blobs.push({
      x: Math.round(crownCenterX + Math.cos(angle) * distanceX),
      y: Math.round(crownCenterY + Math.sin(angle) * distanceY - decision.crownHeight * 0.16),
      radiusX: Math.max(10, Math.round(decision.crownWidth * (0.19 + random() * 0.12))),
      radiusY: Math.max(8, Math.round(decision.crownHeight * (0.17 + random() * 0.12))),
      tone,
    });
  }

  blobs.unshift({
    x: crownCenterX,
    y: Math.round(crownCenterY - decision.crownHeight * 0.16),
    radiusX: Math.max(16, Math.round(decision.crownWidth * 0.34)),
    radiusY: Math.max(14, Math.round(decision.crownHeight * 0.3)),
    tone: "main",
  });

  return blobs;
}

function buildLeafPixelPlans(
  random: () => number,
  crownCenterX: number,
  crownCenterY: number,
  decision: PixelTreeVisualDecision,
): PixelTreeLeafPixelPlan[] {
  const leaves: PixelTreeLeafPixelPlan[] = [];
  const radiusX = decision.crownWidth * 0.5;
  const radiusY = decision.crownHeight * 0.42;
  const centerY = crownCenterY - decision.crownHeight * 0.14;

  for (let index = 0; index < decision.leafPixelCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random());
    const x = crownCenterX + Math.cos(angle) * radiusX * distance;
    const y = centerY + Math.sin(angle) * radiusY * distance;
    const toneRandom = random();
    const tone: PixelTreeTone = toneRandom > 0.82 ? "light" : toneRandom < 0.24 ? "dark" : "main";

    leaves.push({
      x: Math.round(x),
      y: Math.round(y),
      size: choosePixelSize(random, decision.speciesStyle),
      tone,
    });
  }

  return leaves;
}

function choosePixelSize(random: () => number, speciesStyle: PixelTreeVisualDecision["speciesStyle"]): number {
  const roll = random();

  if (speciesStyle === "dry_sparse") {
    return roll > 0.76 ? 6 : roll > 0.38 ? 4 : 3;
  }

  return roll > 0.72 ? 8 : roll > 0.34 ? 6 : 4;
}

function resolveLeafColor(palette: PixelTreePalette, tone: PixelTreeTone): string {
  if (tone === "dark") {
    return palette.leafDark;
  }

  if (tone === "light") {
    return palette.leafLight;
  }

  return palette.leafMain;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
