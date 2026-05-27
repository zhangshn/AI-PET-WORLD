import type {
  SpaceRegionKind,
  SpaceTerrainKind,
} from "@/world/space"

export type TraceType =
  | "spatial_use"
  | "movement"
  | "ecology_change"
  | "behavior_activity"
  | "construction_maintenance"
  | "relationship_interaction"
  | "emotion_attention"
  | "time_passage"
  | "event_impact"

export type TraceLifecyclePhase =
  | "generated"
  | "accumulating"
  | "strengthened"
  | "decaying"
  | "covered"
  | "repaired"
  | "transformed"
  | "deposited"

export type TraceSourceKind =
  | "space_projection"
  | "movement_compatibility_input"
  | "ecology_state"
  | "placement_state"
  | "butler_behavior"
  | "pet_behavior"
  | "world_event"
  | "world_event_placeholder"
  | "time_passage"
  | "user_attention"
  | "relationship_state"
  | "memory_projection"
  | "unknown"

export type TraceStrengthLevel =
  | "none"
  | "weak"
  | "medium"
  | "strong"
  | "landmark"

export type TraceArea = {
  x: number
  y: number
  radius: number
  minX?: number
  minY?: number
  maxX?: number
  maxY?: number
}

export type TraceTargetKind =
  | "world"
  | "region"
  | "cell"
  | "placement"
  | "actor"
  | "relationship"
  | "event"

export type TraceTargetRef = {
  kind: TraceTargetKind
  id: string
  label?: string
}

export type TraceAnchor = {
  primary: TraceTargetRef
  secondary: TraceTargetRef[]
  fallback: boolean
  reason: string
}

export type TraceScopeKind =
  | "world_level"
  | "region_level"
  | "cell_level"
  | "object_level"
  | "actor_level"
  | "relationship_level"
  | "event_level"

export type TraceScope = {
  kind: TraceScopeKind
  targetKinds: TraceTargetKind[]
  cellIds: string[]
  placementIds: string[]
  regionKinds: SpaceRegionKind[]
  terrainKinds: SpaceTerrainKind[]
}

export type TraceEffects = {
  movementCostDelta: number
  familiarityDelta: number
  ecologyHealthDelta: number
  safetyFeelingDelta: number
  maintenancePriorityDelta: number
  behaviorProbabilityDelta: number
  memoryWeightDelta: number
  visualIntensityDelta: number
  relationshipWeightDelta: number
}

export type TraceVisualKind =
  | "flattened_grass"
  | "exposed_soil"
  | "worn_ground"
  | "moss"
  | "mushroom"
  | "repaired_ground"
  | "maintained_area"
  | "faded_area"
  | "waiting_spot"
  | "comfort_spot"
  | "attention_glow"
  | "none"

export type TraceVisualHints = {
  visualKind: TraceVisualKind
  intensity: number
  opacityHint: number
  layerHint: "ground" | "surface" | "object" | "atmosphere" | "none"
  textureHint?: string
  colorMoodHint?: string
  animationHint?: "none" | "pulse" | "drift" | "fade"
  displayPriority: number
  userFacingLabel?: string
  productSafeDescription: string
}

export type TraceEvidenceLevel = "low" | "medium" | "high"

export type TraceSourceReliability =
  | "fallback"
  | "derived"
  | "observed"
  | "explicit"

export type TraceAudit = {
  evidenceLevel: TraceEvidenceLevel
  sourceReliability: TraceSourceReliability
  derivedFrom: string[]
  generationReason: string
  warnings: string[]
  tags: string[]
}

export type TraceFact = {
  id: string
  type: TraceType
  sourceKind: TraceSourceKind
  lifecyclePhase: TraceLifecyclePhase
  strength: number
  strengthLevel: TraceStrengthLevel
  age: number
  confidence: number
  area: TraceArea
  target: TraceTargetRef
  anchor: TraceAnchor
  scope: TraceScope
  relatedCellIds: string[]
  relatedPlacementIds: string[]
  regionKinds: SpaceRegionKind[]
  terrainKinds: SpaceTerrainKind[]
  effects: TraceEffects
  visualHints: TraceVisualHints
  evidenceLevel: TraceEvidenceLevel
  sourceReliability: TraceSourceReliability
  derivedFrom: string[]
  createdAtTick: number
  updatedAtTick: number
  lastReinforcedTick?: number
  generationReason: string
  warnings: string[]
  audit: TraceAudit
  tags: string[]
}

export type TraceFieldSummary = {
  totalTraces: number
  spatialUseTraces: number
  movementTraces: number
  ecologyChangeTraces: number
  behaviorActivityTraces: number
  constructionMaintenanceTraces: number
  relationshipInteractionTraces: number
  emotionAttentionTraces: number
  timePassageTraces: number
  eventImpactTraces: number
  weakTraces: number
  mediumTraces: number
  strongTraces: number
  landmarkTraces: number
  averageStrength: number
  averageAge: number
  lifecycleCounts: Record<TraceLifecyclePhase, number>
  sourceCounts: Record<TraceSourceKind, number>
}

export type TraceField = {
  id: string
  worldId: string
  traces: TraceFact[]
  projectedCellIds: string[]
  summary: TraceFieldSummary
}
