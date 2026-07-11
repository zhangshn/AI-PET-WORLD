export type ButlerBehaviorType =
  | "inspect_entity"
  | "harvest_resource"
  | "clear_resource"
  | "water_resource"
  | "place_resource";

export type ButlerBehaviorStatus =
  | "planned"
  | "applied"
  | "rejected";

export interface ButlerBehaviorTarget {
  chunkId: string;
  entityId: string;
  entityType: string;
  tileX: number;
  tileY: number;
}

export interface ButlerBehaviorIntent {
  intentVersion: string;
  intentId: string;
  actorId: string;
  behaviorType: ButlerBehaviorType;
  target: ButlerBehaviorTarget;
  requestedTick: number;
  sourceWorldStatePayloadHash: string;
  sourceRuntimeSnapshotPath: string;
  createdAt: string;
}

export interface EntityFieldMutation {
  entityId: string;
  entityType: string;
  fieldPath: string;
  before: unknown;
  after: unknown;
}

export interface ButlerResourceDelta {
  resourceType: string;
  amount: number;
  inventoryTarget: string;
  reason: string;
}

export interface ButlerWorldMutationRecord {
  mutationVersion: string;
  mutationId: string;
  status: ButlerBehaviorStatus;
  intentId: string;
  actorId: string;
  behaviorType: ButlerBehaviorType;
  sourceWorldStatePath: string;
  sourceWorldStatePayloadHash: string;
  affectedChunkIds: string[];
  entityMutations: EntityFieldMutation[];
  resourceDeltas: ButlerResourceDelta[];
  collisionProjectionRefreshRequired: boolean;
  runtimeSnapshotRefreshRequired: boolean;
  visualRefreshRequired: boolean;
  forbiddenSideEffects: {
    writesImageFiles: false;
    writesTrainingSamples: false;
    writesApprovedVisuals: false;
    bypassesRuntimePageGate: false;
  };
  createdAt: string;
}

export interface ButlerWorldStateDelta {
  deltaVersion: string;
  deltaId: string;
  mutationId: string;
  sourceWorldStatePayloadHash: string;
  affectedChunkIds: string[];
  entityMutations: EntityFieldMutation[];
  nextRequiredPipelines: {
    lifecycleRefresh: boolean;
    collisionProjectionRefresh: boolean;
    runtimeActivationRefresh: boolean;
    chunkVisualInputRefresh: boolean;
    candidateGeneration: boolean;
    ownerApprovalBeforeRuntimePage: boolean;
  };
  createdAt: string;
}
