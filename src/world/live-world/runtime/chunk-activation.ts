import type {
  RuntimeActivationSnapshot,
  RuntimeChunkActivationRecord,
} from "../types/runtime-types";
import type { ChunkState, WorldState } from "../types/world-types";

export interface ChunkCoordinate {
  chunkX: number;
  chunkY: number;
}

export interface BuildRuntimeActivationSnapshotOptions {
  runtimeSnapshotVersion: string;
  sourceWorldStatePayloadHash: string;
  createdAt: string;
}

function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

function chunkMap(worldState: WorldState): Map<string, ChunkState> {
  return new Map(
    worldState.chunks.map((chunk) => [chunkKey(chunk.chunkX, chunk.chunkY), chunk]),
  );
}

export function worldTileToChunkCoordinate(
  worldState: WorldState,
  worldTileX: number,
  worldTileY: number,
): ChunkCoordinate {
  return {
    chunkX: Math.floor(worldTileX / worldState.chunkSize) - worldState.chunkRadius,
    chunkY: Math.floor(worldTileY / worldState.chunkSize) - worldState.chunkRadius,
  };
}

function activationRecord(
  chunk: ChunkState,
  center: ChunkCoordinate,
  isActive: boolean,
): RuntimeChunkActivationRecord {
  return {
    chunkId: chunk.chunkId,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    distanceFromPlayerChunkX: chunk.chunkX - center.chunkX,
    distanceFromPlayerChunkY: chunk.chunkY - center.chunkY,
    runtimeState: {
      loadedState: isActive ? "active" : "sleeping",
      isActive,
      lastActiveTick: isActive ? 0 : chunk.runtimeState.lastActiveTick,
      lastUpdatedTick: 0,
    },
  };
}

export function buildRuntimeActivationSnapshot(
  worldState: WorldState,
  options: BuildRuntimeActivationSnapshotOptions,
): RuntimeActivationSnapshot {
  if (!worldState.playerState) {
    throw new Error("WorldState.playerState is required for runtime activation.");
  }

  const center = worldTileToChunkCoordinate(
    worldState,
    worldState.playerState.worldTileX,
    worldState.playerState.worldTileY,
  );
  const chunks = chunkMap(worldState);
  const activeChunks: RuntimeChunkActivationRecord[] = [];
  const sleepingChunks: RuntimeChunkActivationRecord[] = [];
  const missingChunkIds: string[] = [];

  for (
    let chunkY = center.chunkY - worldState.activeChunkRadius;
    chunkY <= center.chunkY + worldState.activeChunkRadius;
    chunkY += 1
  ) {
    for (
      let chunkX = center.chunkX - worldState.activeChunkRadius;
      chunkX <= center.chunkX + worldState.activeChunkRadius;
      chunkX += 1
    ) {
      const chunk = chunks.get(chunkKey(chunkX, chunkY));
      if (!chunk) {
        missingChunkIds.push(chunkKey(chunkX, chunkY));
        continue;
      }

      activeChunks.push(activationRecord(chunk, center, true));
    }
  }

  const activeIds = new Set(activeChunks.map((chunk) => chunk.chunkId));

  for (const chunk of worldState.chunks) {
    if (!activeIds.has(chunk.chunkId)) {
      sleepingChunks.push(activationRecord(chunk, center, false));
    }
  }

  const centerChunk = chunks.get(chunkKey(center.chunkX, center.chunkY));

  if (!centerChunk) {
    throw new Error(`Center chunk is missing: ${chunkKey(center.chunkX, center.chunkY)}`);
  }

  return {
    runtimeSnapshotVersion: options.runtimeSnapshotVersion,
    sourceWorldStatePayloadHash: options.sourceWorldStatePayloadHash,
    worldId: worldState.worldId,
    seed: worldState.seed,
    playerId: worldState.playerState.playerId,
    playerWorldTileX: worldState.playerState.worldTileX,
    playerWorldTileY: worldState.playerState.worldTileY,
    centerChunkId: centerChunk.chunkId,
    centerChunkX: center.chunkX,
    centerChunkY: center.chunkY,
    activeChunkRadius: 1,
    activeChunkIds: activeChunks.map((chunk) => chunk.chunkId),
    sleepingChunkIds: sleepingChunks.map((chunk) => chunk.chunkId),
    missingChunkIds,
    activeChunks,
    sleepingChunks,
    runtimeReadBoundary: {
      allowedSource: "WorldState",
      forbiddenSources: [
        ".runtime/ai-painter",
        "data/world-visual-candidates",
        "data/world-samples",
      ],
      allowTrainingArtifacts: false,
      allowUnreviewedCandidates: false,
    },
    createdAt: options.createdAt,
  };
}
