import type { ChunkRuntimeState } from "./world-types";

export interface RuntimeChunkActivationRecord {
  chunkId: string;
  chunkX: number;
  chunkY: number;
  distanceFromPlayerChunkX: number;
  distanceFromPlayerChunkY: number;
  runtimeState: ChunkRuntimeState;
}

export interface RuntimeActivationSnapshot {
  runtimeSnapshotVersion: string;
  sourceWorldStatePayloadHash: string;

  worldId: string;
  seed: string;

  playerId: string;
  playerWorldTileX: number;
  playerWorldTileY: number;
  centerChunkId: string;
  centerChunkX: number;
  centerChunkY: number;

  activeChunkRadius: 1;
  activeChunkIds: string[];
  sleepingChunkIds: string[];
  missingChunkIds: string[];

  activeChunks: RuntimeChunkActivationRecord[];
  sleepingChunks: RuntimeChunkActivationRecord[];

  runtimeReadBoundary: {
    allowedSource: "WorldState";
    forbiddenSources: string[];
    allowTrainingArtifacts: false;
    allowUnreviewedCandidates: false;
  };

  createdAt: string;
}
