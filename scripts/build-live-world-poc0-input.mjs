import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = join(
  ROOT,
  "data",
  "live-world",
  "poc-inputs",
  "poc-0-input.chunk.json",
);

const SIZE = 32;
const TILE_SIZE = 16;

function makeGrid(value) {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => value),
  );
}

function setRect(grid, x0, y0, x1, y1, value) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      grid[y][x] = value;
    }
  }
}

function setPath(grid, points, value) {
  for (const [x, y] of points) {
    grid[y][x] = value;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashPayload(input) {
  const clone = structuredClone(input);
  clone.inputPayloadHash = "";
  return createHash("sha256").update(stableStringify(clone)).digest("hex");
}

const terrainMask = makeGrid("grass");
const biomeMask = makeGrid("open_grassland");

setRect(terrainMask, 26, 0, 31, 31, "water");
setRect(biomeMask, 24, 0, 31, 31, "water_edge");

setRect(terrainMask, 24, 0, 25, 31, "shoreline");
setRect(terrainMask, 22, 19, 23, 28, "wetland");
setRect(biomeMask, 22, 18, 25, 30, "wetland_edge");

setRect(biomeMask, 2, 2, 15, 10, "small_woods");
setRect(biomeMask, 4, 20, 12, 27, "stone_patch");
setRect(biomeMask, 13, 13, 19, 17, "home_entrance");

const dirtPath = [
  [0, 25],
  [1, 24],
  [2, 24],
  [3, 23],
  [4, 23],
  [5, 22],
  [6, 22],
  [7, 21],
  [8, 21],
  [9, 20],
  [10, 20],
  [11, 19],
  [12, 18],
  [13, 17],
  [14, 16],
  [15, 16],
  [16, 15],
  [17, 15],
  [18, 15],
  [19, 15],
  [20, 15],
  [21, 15],
  [22, 15],
  [23, 15],
];
setPath(terrainMask, dirtPath, "dirt_path");
setPath(biomeMask, dirtPath, "home_entrance");

const entityMap = [
  {
    entityId: "poc0-tree-01",
    entityType: "tree",
    stage: "mature",
    tileX: 5,
    tileY: 5,
    widthTiles: 3,
    heightTiles: 3,
    blocksMovement: true,
    sourceRuleId: "mvp.tree.small_woods",
  },
  {
    entityId: "poc0-tree-02",
    entityType: "tree",
    stage: "mature",
    tileX: 10,
    tileY: 7,
    widthTiles: 3,
    heightTiles: 3,
    blocksMovement: true,
    sourceRuleId: "mvp.tree.small_woods",
  },
  {
    entityId: "poc0-tree-03",
    entityType: "tree",
    stage: "young",
    tileX: 16,
    tileY: 6,
    widthTiles: 2,
    heightTiles: 2,
    blocksMovement: true,
    sourceRuleId: "mvp.tree.water_edge",
  },
  {
    entityId: "poc0-rock-01",
    entityType: "rock",
    stage: "medium",
    tileX: 8,
    tileY: 23,
    widthTiles: 1,
    heightTiles: 1,
    blocksMovement: true,
    sourceRuleId: "mvp.rock.stone_patch",
  },
  {
    entityId: "poc0-rock-02",
    entityType: "rock",
    stage: "small",
    tileX: 19,
    tileY: 20,
    widthTiles: 1,
    heightTiles: 1,
    blocksMovement: true,
    sourceRuleId: "mvp.rock.open_grassland",
  },
  ...[
    [3, 16],
    [6, 18],
    [12, 11],
    [18, 12],
    [21, 21],
    [7, 28],
  ].map(([tileX, tileY], index) => ({
    entityId: `poc0-grass-clump-${String(index + 1).padStart(2, "0")}`,
    entityType: "grass_clump",
    stage: "mature",
    tileX,
    tileY,
    widthTiles: 1,
    heightTiles: 1,
    blocksMovement: false,
    sourceRuleId: "mvp.grass_clump.open_grassland",
  })),
  ...[
    [4, 14],
    [9, 13],
    [14, 20],
    [20, 10],
    [23, 17],
  ].map(([tileX, tileY], index) => ({
    entityId: `poc0-flower-${String(index + 1).padStart(2, "0")}`,
    entityType: "flower",
    stage: "blooming",
    tileX,
    tileY,
    widthTiles: 1,
    heightTiles: 1,
    blocksMovement: false,
    sourceRuleId: "mvp.flower.water_edge",
  })),
  ...[
    [24, 4],
    [23, 20],
    [24, 24],
    [23, 27],
  ].map(([tileX, tileY], index) => ({
    entityId: `poc0-reed-${String(index + 1).padStart(2, "0")}`,
    entityType: "reed",
    stage: "mature",
    tileX,
    tileY,
    widthTiles: 1,
    heightTiles: 2,
    blocksMovement: false,
    sourceRuleId: "mvp.reed.water_edge",
  })),
];

const collisionMask = makeGrid(0);

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    if (terrainMask[y][x] === "water") {
      collisionMask[y][x] = 1;
    }
  }
}

for (const entity of entityMap) {
  if (entity.blocksMovement) {
    collisionMask[entity.tileY][entity.tileX] = 1;
  }
}

const walkableMask = collisionMask.map((row) =>
  row.map((value) => (value === 1 ? 0 : 1)),
);

const input = {
  inputVersion: "live-world-poc0-input-v1",
  worldRuleVersion: "live-world-rule-v1.2",
  generatorVersion: "manual-poc0-builder-v1",
  inputPayloadHash: "",

  chunkId: "poc0-chunk-0-0",
  chunkX: 0,
  chunkY: 0,

  tileWidth: SIZE,
  tileHeight: SIZE,
  tileSize: TILE_SIZE,

  pixelWidth: SIZE * TILE_SIZE,
  pixelHeight: SIZE * TILE_SIZE,

  terrainMask,
  biomeMask,
  walkableMask,
  collisionMask,

  entityMap,

  neighborContext: {
    north: {
      chunkId: "poc0-neighbor-north",
      terrainEdge: terrainMask[0],
      biomeEdge: biomeMask[0],
      movementEdge: terrainMask[0].map((terrain) =>
        terrain === "water" ? "blocked" : "walkable",
      ),
      entityEdgeHints: [],
    },
    south: {
      chunkId: "poc0-neighbor-south",
      terrainEdge: terrainMask[SIZE - 1],
      biomeEdge: biomeMask[SIZE - 1],
      movementEdge: terrainMask[SIZE - 1].map((terrain) =>
        terrain === "water" ? "blocked" : "walkable",
      ),
      entityEdgeHints: [],
    },
    west: {
      chunkId: "poc0-neighbor-west",
      terrainEdge: terrainMask.map((row) => row[0]),
      biomeEdge: biomeMask.map((row) => row[0]),
      movementEdge: terrainMask.map((row) =>
        row[0] === "water" ? "blocked" : "walkable",
      ),
      entityEdgeHints: [],
    },
    east: {
      chunkId: "poc0-neighbor-east",
      terrainEdge: terrainMask.map((row) => row[SIZE - 1]),
      biomeEdge: biomeMask.map((row) => row[SIZE - 1]),
      movementEdge: terrainMask.map((row) =>
        row[SIZE - 1] === "water" ? "blocked" : "walkable",
      ),
      entityEdgeHints: [],
    },
  },

  styleProfile: {
    styleProfileId: "natural-home-pixel-art-v1",
    camera: "top_down",
    pixelArt: true,
    targetTileSize: TILE_SIZE,
    notes: "POC-0 natural home chunk, structure-first visual input.",
  },

  visualConstraints: {
    forbidUnlistedInteractiveResources: true,
    allowedDecorations: [
      "grass_detail",
      "tiny_flower_detail",
      "fallen_leaf",
      "small_pebble",
      "shore_foam",
      "mud_patch",
    ],
    forbiddenObjects: [
      "building",
      "npc",
      "bridge",
      "fence",
      "chest",
      "extra_large_tree",
      "extra_large_rock",
    ],
    entityCountPolicy: {
      tree: "exact",
      rock: "exact",
      berry_bush: "exact",
      reed: "approximate",
      flower: "approximate",
      grass_clump: "approximate",
    },
    maxEntityCenterOffsetTiles: 1,
    preserveTerrainMask: {
      water: true,
      dirt_path: true,
      shoreline: true,
    },
    preserveChunkEdges: true,
  },
};

input.inputPayloadHash = hashPayload(input);

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(input, null, 2)}\n`, "utf8");

console.log(`Wrote ${OUTPUT_PATH}`);
console.log(`inputPayloadHash=${input.inputPayloadHash}`);

