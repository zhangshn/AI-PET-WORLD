import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";
const batchId = "p10-active-chunk-visual-generation-batch-0001";

const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const runtimeSnapshotPath = path.join(root, "data/live-world/runtime-states/p3-runtime-activation-snapshot.json");
const pageGatePath = path.join(root, "data/live-world/page-gates/p7-runtime-page-gate.json");
const outputRoot = path.join(root, "data/live-world/visual-generation-requests/p10-active-chunks");
const manifestPath = path.join(outputRoot, "generation-batch.json");
const latestPath = path.join(root, "data/live-world/visual-generation-requests/latest-generation-batch.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function hashVisualInput(input) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize({ ...input, inputPayloadHash: "" })))
    .digest("hex");
}

function visualEntityFromWorldEntity(entity) {
  return {
    entityId: entity.entityId,
    entityType: entity.entityType,
    stage: entity.lifecycle.stage,
    tileX: entity.tileX,
    tileY: entity.tileY,
    widthTiles: entity.widthTiles,
    heightTiles: entity.heightTiles,
    blocksMovement: entity.collision.blocksMovement,
    sourceRuleId: entity.sourceRuleId,
  };
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function edgeFromChunk(chunk, side) {
  if (!chunk) return undefined;
  const last = chunk.width - 1;
  const terrainEdge = [];
  const biomeEdge = [];
  const movementEdge = [];

  for (let index = 0; index < chunk.width; index += 1) {
    const tile =
      side === "north"
        ? chunk.tiles[0][index]
        : side === "south"
          ? chunk.tiles[last][index]
          : side === "west"
            ? chunk.tiles[index][0]
            : chunk.tiles[index][last];

    terrainEdge.push(tile.terrainType);
    biomeEdge.push(tile.biomeType);
    movementEdge.push(tile.movementClass);
  }

  const entityEdgeHints = chunk.entities
    .map((entity) => {
      const distanceToEdge =
        side === "north"
          ? entity.tileY
          : side === "south"
            ? last - entity.tileY
            : side === "west"
              ? entity.tileX
              : last - entity.tileX;
      return {
        entityId: entity.entityId,
        entityType: entity.entityType,
        stage: entity.lifecycle.stage,
        tileX: entity.tileX,
        tileY: entity.tileY,
        distanceToEdge,
      };
    })
    .filter((hint) => hint.distanceToEdge <= 2);

  return {
    chunkId: chunk.chunkId,
    terrainEdge,
    biomeEdge,
    movementEdge,
    entityEdgeHints,
  };
}

function buildNeighborContext(chunk, chunkByCoord) {
  return {
    north: edgeFromChunk(chunkByCoord.get(chunkKey(chunk.chunkX, chunk.chunkY - 1)), "south"),
    south: edgeFromChunk(chunkByCoord.get(chunkKey(chunk.chunkX, chunk.chunkY + 1)), "north"),
    west: edgeFromChunk(chunkByCoord.get(chunkKey(chunk.chunkX - 1, chunk.chunkY)), "east"),
    east: edgeFromChunk(chunkByCoord.get(chunkKey(chunk.chunkX + 1, chunk.chunkY)), "west"),
  };
}

function buildVisualInput(chunk, worldState, chunkByCoord) {
  const terrainMask = chunk.tiles.map((row) => row.map((tile) => tile.terrainType));
  const biomeMask = chunk.tiles.map((row) => row.map((tile) => tile.biomeType));
  const walkableMask = chunk.walkableLayer.map((row) => row.map((cell) => (cell.walkable ? 1 : 0)));
  const collisionMask = chunk.collisionLayer.map((row) => row.map((cell) => (cell.blocksMovement ? 1 : 0)));

  const visualInput = {
    inputVersion: "live-world-p10-active-chunk-visual-input-v1",
    worldRuleVersion: worldState.worldRuleVersion,
    generatorVersion: "active-chunk-visual-generation-batch-v1",
    inputPayloadHash: "",
    chunkId: chunk.chunkId,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    tileWidth: chunk.width,
    tileHeight: chunk.height,
    tileSize: worldState.tileSize,
    pixelWidth: chunk.width * worldState.tileSize,
    pixelHeight: chunk.height * worldState.tileSize,
    terrainMask,
    biomeMask,
    walkableMask,
    collisionMask,
    entityMap: chunk.entities.map(visualEntityFromWorldEntity),
    neighborContext: buildNeighborContext(chunk, chunkByCoord),
    styleProfile: {
      styleProfileId: "natural-home-pixel-art-v1",
      camera: "three_quarter",
      pixelArt: true,
      targetTileSize: 16,
      notes: "Render a readable natural home game chunk from structured world data. Do not add unlisted interactive resources.",
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
        grass_clump: "approximate",
        flower: "approximate",
        berry_bush: "exact",
        reed: "approximate",
      },
      maxEntityCenterOffsetTiles: 1,
      preserveTerrainMask: {
        water: true,
        dirt_path: true,
        shoreline: true,
      },
      preserveChunkEdges: true,
    },
    sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  };

  visualInput.inputPayloadHash = hashVisualInput(visualInput);
  return visualInput;
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const runtimeSnapshot = JSON.parse(await readFile(runtimeSnapshotPath, "utf8"));
const pageGate = JSON.parse(await readFile(pageGatePath, "utf8"));
const chunkById = new Map(worldState.chunks.map((chunk) => [chunk.chunkId, chunk]));
const chunkByCoord = new Map(worldState.chunks.map((chunk) => [chunkKey(chunk.chunkX, chunk.chunkY), chunk]));

const entries = [];
await mkdir(outputRoot, { recursive: true });

for (const [index, chunkId] of runtimeSnapshot.activeChunkIds.entries()) {
  const chunk = chunkById.get(chunkId);
  if (!chunk) throw new Error(`Missing active chunk in WorldState: ${chunkId}`);

  const requestId = `p10-visual-request-${String(index + 1).padStart(2, "0")}`;
  const candidateId = `p10-active-chunk-candidate-${String(index + 1).padStart(2, "0")}`;
  const requestRoot = path.join(outputRoot, requestId);
  const visualInputPath = path.join(requestRoot, "chunk-visual-input.json");
  const visualInput = buildVisualInput(chunk, worldState, chunkByCoord);

  await mkdir(requestRoot, { recursive: true });
  await writeFile(visualInputPath, `${JSON.stringify(visualInput, null, 2)}\n`, "utf8");

  entries.push({
    requestId,
    candidateId,
    chunkId,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    inputPayloadHash: visualInput.inputPayloadHash,
    visualInputPath: projectPath(visualInputPath),
    expectedCandidateRoot: `data/world-visual-candidates/${candidateId}`,
    expectedOutputImagePath: `data/world-visual-candidates/${candidateId}/output.image.png`,
    status: "waiting_for_ai_painter",
  });
}

const manifest = {
  batchVersion: "live-world-p10-active-chunk-visual-generation-batch-v1",
  batchId,
  status: "ready_for_ai_painter",
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  sourceRuntimeSnapshotPath: projectPath(runtimeSnapshotPath),
  sourceRuntimePageGatePath: projectPath(pageGatePath),
  sourceRuntimePageGateStatus: pageGate.status,
  activeChunkCount: runtimeSnapshot.activeChunkIds.length,
  requestCount: entries.length,
  entries,
  readBoundary: {
    allowedReadRoots: [
      "data/live-world/world-states",
      "data/live-world/runtime-states",
      "data/live-world/visual-generation-requests",
    ],
    forbiddenReadRoots: [
      "data/live-world/approved-visuals",
      "data/world-samples/pending",
      "data/world-samples/rejected",
      "data/world-runs",
    ],
    canWriteCandidates: true,
    canWriteApprovedVisuals: false,
    canWriteTrainingSamples: false,
    canBypassRuntimePageGate: false,
  },
  nextRequiredPipelines: {
    aiPainterGeneration: true,
    autoStructureReview: true,
    ownerReview: true,
    approvedVisualPromotion: true,
    runtimePageGateRefresh: true,
  },
  createdAt: now,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await mkdir(path.dirname(latestPath), { recursive: true });
await writeFile(
  latestPath,
  `${JSON.stringify(
    {
      batchId,
      status: manifest.status,
      manifestPath: projectPath(manifestPath),
      requestCount: manifest.requestCount,
      canWriteCandidates: true,
      canWriteApprovedVisuals: false,
      canBypassRuntimePageGate: false,
      createdAt: now,
    },
    null,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${projectPath(manifestPath)}`);
console.log(`batchId=${batchId}`);
console.log(`status=${manifest.status}`);
console.log(`requestCount=${manifest.requestCount}`);
console.log(`canWriteCandidates=${manifest.readBoundary.canWriteCandidates}`);
console.log(`canWriteApprovedVisuals=${manifest.readBoundary.canWriteApprovedVisuals}`);
