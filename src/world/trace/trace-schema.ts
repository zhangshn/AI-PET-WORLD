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
  | "time_passage"
  | "event_impact"

export type TraceLifecyclePhase =
  | "generated"
  | "accumulating"
  | "strengthened"
  | "decaying"
  | "covered"
  | "repaired"
  | "deposited"

export type TraceSourceKind =
  | "space_projection"
  | "movement_compatibility_input"
  | "ecology_state"
  | "placement_state"
  | "world_event_placeholder"
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
  relatedCellIds: string[]
  relatedPlacementIds: string[]
  regionKinds: SpaceRegionKind[]
  terrainKinds: SpaceTerrainKind[]
  createdAtTick: number
  updatedAtTick: number
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
