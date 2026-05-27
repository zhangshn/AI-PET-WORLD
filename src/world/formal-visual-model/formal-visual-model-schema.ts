/**
 * 当前文件职责：定义 FormalVisualModel 正式视觉模型协议。
 */

import type {
  RenderableWorldSnapshot,
  VisualActorGeometryProjection,
  VisualPlacement,
  VisualState,
} from "@/world/rendering/renderer-gateway"
import type { Point2D, SpatialShape } from "@/world/spatial/spatial-gateway"
import type { TraceVisualProjection } from "@/world/trace"

export type FormalVisualModelVersion = "formal_visual_model_v0"

export type FormalVisualModelSource =
  | "visual_state"
  | "renderable_world_snapshot"

export type FormalVisualTraceSource =
  | "visual_state"
  | "renderable_world_snapshot"
  | "visual_placement"
  | "visual_actor_geometry_projection"
  | "visual_terrain_cell"
  | "world_runtime_summary"
  | "formal_visual_generator"

export type FormalVisualLayer =
  | "ground"
  | "path"
  | "structure"
  | "facility"
  | "nature"
  | "surfaceDecoration"
  | "actor"
  | "environment"
  | "hud"
  | "unknown"

export type FormalWorldObjectKind =
  | "terrain"
  | "path"
  | "shelter"
  | "structure"
  | "facility"
  | "tree"
  | "bush"
  | "surfaceDecoration"
  | "resource"
  | "lifeTrace"
  | "boundary"
  | "unknown"

export type FormalActorKind = VisualActorGeometryProjection["actorKind"]

export type FormalVisualStyleToken =
  | "neutral"
  | "warmNatural"
  | "ordered"
  | "protective"
  | "quiet"
  | "exploratory"
  | "caretaking"
  | "unknown"

export type FormalCanvasMood =
  | "calm"
  | "warm"
  | "quiet"
  | "alert"
  | "recovering"
  | "active"
  | "unknown"

export type FormalAtmosphereTone =
  | "morning"
  | "day"
  | "evening"
  | "night"
  | "rain"
  | "clear"
  | "cloudy"
  | "unknown"

export type FormalActorPoseToken =
  | "idle"
  | "observing"
  | "working"
  | "resting"
  | "approaching"
  | "unknown"

export type FormalPetStatusToken =
  | "notEntered"
  | "lifeTraceOnly"
  | "accepted"
  | "present"
  | "unknown"

export type FormalVisualSourceTrace = {
  source: FormalVisualTraceSource
  sourceId: string
  worldId: string
}

export type FormalVisualAuditSummary = {
  source: FormalVisualModelSource
  worldId: string
  visualPlacementCount: number
  visualActorProjectionCount: number
  visualTerrainCellCount: number
  drawCommandCount: number
  warnings: string[]
  auditTags: string[]
}

export type FormalCanvasModel = {
  worldId: string
  width: number
  height: number
  tileSize: number
  mood: FormalCanvasMood
  atmosphere: FormalAtmosphereTone
  styleToken: FormalVisualStyleToken
  source: FormalVisualSourceTrace
  auditTags: string[]
}

export type FormalWorldObjectModel = {
  id: string
  kind: FormalWorldObjectKind
  label: string
  layer: FormalVisualLayer
  geometry: SpatialShape
  anchor: Point2D
  styleToken: FormalVisualStyleToken
  opacity: number
  source: FormalVisualSourceTrace
  auditTags: string[]
}

export type FormalActorModel = {
  actorId: string
  actorKind: FormalActorKind
  label: string
  body: SpatialShape
  aura?: SpatialShape
  anchor: Point2D
  poseToken: FormalActorPoseToken
  styleToken: FormalVisualStyleToken
  canRender: true
  source: FormalVisualSourceTrace
  auditTags: string[]
}

export type FormalEnvironmentModel = {
  worldId: string
  mood: FormalCanvasMood
  atmosphere: FormalAtmosphereTone
  styleToken: FormalVisualStyleToken
  timeLabel: string
  weatherLabel: string
  source: FormalVisualSourceTrace
  auditTags: string[]
}

export type FormalHudSummary = {
  worldId: string
  worldPhaseLabel: string
  butlerStatusLabel: string
  petStatus: FormalPetStatusToken
  petStatusLabel: string
  recentLogHint: string
  playerFacingNotes: string[]
  source: FormalVisualSourceTrace
  auditTags: string[]
}

export type FormalVisualModel = {
  version: FormalVisualModelVersion
  worldId: string
  canvas: FormalCanvasModel
  objects: FormalWorldObjectModel[]
  actors: FormalActorModel[]
  environment: FormalEnvironmentModel
  hudSummary: FormalHudSummary
  traceVisualProjection?: TraceVisualProjection
  audit: FormalVisualAuditSummary
  auditTags: string[]
}

export type FormalVisualModelInput = {
  snapshot: RenderableWorldSnapshot
  visualState: VisualState
  placements: VisualPlacement[]
  actorGeometryProjections: VisualActorGeometryProjection[]
  traceVisualProjection?: TraceVisualProjection
}

export const FORMAL_VISUAL_MODEL_VERSION: FormalVisualModelVersion =
  "formal_visual_model_v0"
