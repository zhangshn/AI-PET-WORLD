import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const INPUT_PATH = join(
  ROOT,
  "data",
  "live-world",
  "poc-inputs",
  "poc-0-input.chunk.json",
);

const SIZE = 32;
const EXPECTED_COUNTS = {
  tree: 3,
  rock: 2,
  grass_clump: 6,
  flower: 5,
  reed: 4,
  berry_bush: 0,
};

function fail(message) {
  throw new Error(message);
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

function assertGrid(name, grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE) {
    fail(`${name} must have ${SIZE} rows.`);
  }

  for (const [rowIndex, row] of grid.entries()) {
    if (!Array.isArray(row) || row.length !== SIZE) {
      fail(`${name}[${rowIndex}] must have ${SIZE} columns.`);
    }
  }
}

function countEntities(entityMap) {
  const counts = {
    tree: 0,
    rock: 0,
    grass_clump: 0,
    flower: 0,
    berry_bush: 0,
    reed: 0,
  };

  for (const entity of entityMap) {
    if (!(entity.entityType in counts)) {
      fail(`Unexpected entityType: ${entity.entityType}`);
    }

    counts[entity.entityType] += 1;
  }

  return counts;
}

function checkEntityPlacement(input) {
  for (const entity of input.entityMap) {
    const terrain = input.terrainMask[entity.tileY]?.[entity.tileX];
    if (!terrain) {
      fail(`${entity.entityId} is outside terrainMask.`);
    }

    if (terrain === "water") {
      fail(`${entity.entityId} is placed on water.`);
    }

    if (entity.entityType !== "reed" && terrain === "shoreline") {
      fail(`${entity.entityId} is placed on shoreline but is not reed.`);
    }

    if (entity.entityType === "reed" && !["shoreline", "wetland"].includes(terrain)) {
      fail(`${entity.entityId} must be placed on shoreline or wetland.`);
    }

    if (
      ["tree", "rock", "berry_bush"].includes(entity.entityType) &&
      terrain === "dirt_path"
    ) {
      fail(`${entity.entityId} blocks the dirt path.`);
    }
  }
}

function checkWaterAndShoreline(input) {
  let waterCount = 0;
  let shorelineCount = 0;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (input.terrainMask[y][x] === "water") {
        waterCount += 1;
        if (input.walkableMask[y][x] !== 0 || input.collisionMask[y][x] !== 1) {
          fail(`Water tile ${x},${y} must be non-walkable and colliding.`);
        }
      }

      if (input.terrainMask[y][x] === "shoreline") {
        shorelineCount += 1;
      }
    }
  }

  if (waterCount === 0) {
    fail("POC-0 must include water.");
  }

  if (shorelineCount === 0) {
    fail("POC-0 must include shoreline.");
  }
}

function checkNeighborContext(input) {
  for (const direction of ["north", "south", "east", "west"]) {
    const edge = input.neighborContext[direction];
    if (!edge) {
      fail(`neighborContext.${direction} is required.`);
    }

    for (const field of ["terrainEdge", "biomeEdge", "movementEdge"]) {
      if (!Array.isArray(edge[field]) || edge[field].length !== SIZE) {
        fail(`neighborContext.${direction}.${field} must have ${SIZE} items.`);
      }
    }
  }
}

const input = JSON.parse(readFileSync(INPUT_PATH, "utf8"));

if (input.tileWidth !== SIZE || input.tileHeight !== SIZE) {
  fail("POC-0 must use 32x32 tiles.");
}

if (input.tileSize !== 16 || input.pixelWidth !== 512 || input.pixelHeight !== 512) {
  fail("POC-0 must use tileSize=16 and output 512x512.");
}

assertGrid("terrainMask", input.terrainMask);
assertGrid("biomeMask", input.biomeMask);
assertGrid("walkableMask", input.walkableMask);
assertGrid("collisionMask", input.collisionMask);

const expectedHash = hashPayload(input);
if (input.inputPayloadHash !== expectedHash) {
  fail(`inputPayloadHash mismatch. expected=${expectedHash} actual=${input.inputPayloadHash}`);
}

const counts = countEntities(input.entityMap);
for (const [entityType, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
  if (counts[entityType] !== expectedCount) {
    fail(`${entityType} count mismatch. expected=${expectedCount} actual=${counts[entityType]}`);
  }
}

checkEntityPlacement(input);
checkWaterAndShoreline(input);
checkNeighborContext(input);

console.log("POC-0 input check passed.");
console.log(`inputPayloadHash=${input.inputPayloadHash}`);

