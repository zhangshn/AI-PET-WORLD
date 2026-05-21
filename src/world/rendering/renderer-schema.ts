/**
 * 当前文件职责：定义 ProceduralRenderer v0 的可视化状态与绘制命令协议。
 */

import type {
  HomeMapSize,
  HomeZoneType,
  MapBounds,
  MapPlacementLayer,
} from "@/world/map-state/home-map-state-schema"

import type {
  ActorGeometryKind,
  ActorGeometryProjection,
  ActorGeometrySource,
} from "@/world/actor-geometry/actor-geometry-gateway"
import type {
  ActorRuntimeGeometryProjectionStatus,
  ActorRuntimePresence,
  ActorRuntimeProjectionSource,
} from "@/world/actor-runtime-projection/actor-runtime-projection-gateway"
import type { TerrainBiome } from "@/world/environment/environment-gateway"
import type { Point2D, SpatialShape } from "@/world/spatial/spatial-gateway"

export type RendererDebugOverlayType =
  | "placement_anchor"
  | "footprint"
  | "collision"
  | "support"
  | "influence"
  | "terrain"
  | "zone_bounds"
  | "labels"
  | "layer_order"

export type VisualRuleStatus = "accepted" | "rejected" | "unmapped" | "unknown"

export type VisualStateSource =
  | "home_map_state"
  | "entity_geometry"
  | "terrain_state"
  | "placement_geometry_audit"
  | "actor_runtime_projection"
  | "actor_geometry_projection"
  | "map_diff_history"

export type VisualZone = {
  id: string
  type: HomeZoneType
  label: string
  bounds: MapBounds
  tags: string[]
}

export type VisualPlacement = {
  placementId: string
  assetId: string
  label: string
  anchor: Point2D
  layer: MapPlacementLayer
  footprint?: SpatialShape
  collision?: SpatialShape
  support?: SpatialShape
  influence?: SpatialShape
  ruleStatus: VisualRuleStatus
  ruleMessage?: string
  alpha: number
  scale: number
  tags: string[]
}

export type VisualTerrainCell = {
  id: string
  x: number
  y: number
  biome: TerrainBiome
  moisture: number
  fertility: number
  sunlight: number
  tags: string[]
}

export type VisualDebugOverlay = {
  type: RendererDebugOverlayType
  enabled: boolean
  label: string
  tags: string[]
}

export type VisualActorGeometryProjection = {
  actorId: string
  actorKind: ActorGeometryKind
  status: ActorRuntimeGeometryProjectionStatus
  presence: ActorRuntimePresence
  source: ActorRuntimeProjectionSource
  geometrySource: ActorGeometrySource
  canProject: boolean
  geometryProjection?: ActorGeometryProjection
  reason: string
  tags: string[]
}

export type VisualState = {
  worldId: string
  mapSize: HomeMapSize
  zones: VisualZone[]
  placements: VisualPlacement[]
  actorGeometryProjections: VisualActorGeometryProjection[]
  terrainCells: VisualTerrainCell[]
  overlays: VisualDebugOverlay[]
  generatedAt: number
  sources: VisualStateSource[]
  tags: string[]
}

export type DrawCommandKind = "point" | "line" | "polygon" | "bounds" | "label"

export type DrawCommandLayer =
  | "terrain"
  | "zone"
  | "placement"
  | "geometry"
  | "debug"
  | "label"

export type DrawCommandDebugStyle = {
  stroke: string
  fill: string
  opacity: number
  strokeWidth: number
  dash?: number[]
}

export type DrawCommand = {
  id: string
  kind: DrawCommandKind
  layer: DrawCommandLayer
  geometry: SpatialShape
  label?: string
  debugStyle: DrawCommandDebugStyle
  source: VisualStateSource
  tags: string[]
}

export type RenderableWorldSnapshot = {
  visualState: VisualState
  drawCommands: DrawCommand[]
  tags: string[]
}

export const DEFAULT_RENDERER_DEBUG_OVERLAYS: VisualDebugOverlay[] = [
  {
    type: "placement_anchor",
    enabled: true,
    label: "Placement 锚点",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "footprint",
    enabled: true,
    label: "占地范围",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "collision",
    enabled: true,
    label: "碰撞范围",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "support",
    enabled: false,
    label: "承重范围",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "influence",
    enabled: false,
    label: "影响范围",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "terrain",
    enabled: true,
    label: "地形单元",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "zone_bounds",
    enabled: true,
    label: "区域边界",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "labels",
    enabled: true,
    label: "标签",
    tags: ["renderer_debug_overlay_v0"],
  },
  {
    type: "layer_order",
    enabled: false,
    label: "层级顺序",
    tags: ["renderer_debug_overlay_v0"],
  },
]
