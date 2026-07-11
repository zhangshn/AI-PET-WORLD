export type EcosystemExpansionCategory =
  | "character"
  | "building"
  | "animal"
  | "ecology";

export type EcosystemEntityKind =
  | "butler_npc"
  | "villager_npc"
  | "storage_shed"
  | "water_well"
  | "workbench"
  | "rabbit"
  | "bird"
  | "butterfly"
  | "tree_seedling_spread"
  | "flower_pollination"
  | "berry_bush_regrowth";

export type EcosystemIntroductionMode =
  | "dictionary_only"
  | "world_state_candidate"
  | "world_state_applied";

export type EcosystemCollisionPolicy =
  | "blocks_movement"
  | "non_blocking"
  | "dynamic_actor"
  | "decorative_only";

export type EcosystemLifecyclePolicy =
  | "none"
  | "growth_cycle"
  | "daily_activity"
  | "seasonal_activity"
  | "decay_or_repair";

export interface EcosystemExpansionEntityDefinition {
  entityKind: EcosystemEntityKind;
  category: EcosystemExpansionCategory;
  introductionMode: EcosystemIntroductionMode;
  displayName: string;
  purpose: string;
  allowedBiomes: string[];
  forbiddenTerrains: string[];
  lifecyclePolicy: EcosystemLifecyclePolicy;
  collisionPolicy: EcosystemCollisionPolicy;
  visualProfilePrefix: string;
  behaviorHooks: string[];
  requiredBeforeWorldStateApply: string[];
}

export interface EcosystemExpansionPlan {
  expansionPlanVersion: string;
  expansionPlanId: string;
  status: "planned_not_applied" | "ready_for_schema_merge" | "applied";
  sourceWorldStatePayloadHash: string;
  sourceRuntimePageGatePath: string;
  definitions: EcosystemExpansionEntityDefinition[];
  safetyBoundary: {
    canModifyWorldState: false;
    canWriteImageFiles: false;
    canWriteTrainingSamples: false;
    canWriteApprovedVisuals: false;
    canBypassRuntimePageGate: false;
  };
  nextRequiredPipelines: {
    schemaMerge: boolean;
    placementRules: boolean;
    lifecycleRules: boolean;
    collisionProjectionRules: boolean;
    visualInputRules: boolean;
    candidateGeneration: boolean;
    ownerApprovalBeforeRuntimePage: boolean;
  };
  createdAt: string;
}
