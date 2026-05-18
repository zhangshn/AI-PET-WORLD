/**
 * 当前文件职责：从 VisualState 派生 ProceduralRenderer v0 的 DrawCommand。
 */

import type { MapBounds } from "@/world/map-state/home-map-state-schema"
import type {
  Point2D,
  Polygon2D,
  SpatialShape,
} from "@/world/spatial/spatial-gateway"

import type {
  DrawCommand,
  DrawCommandDebugStyle,
  RenderableWorldSnapshot,
  RendererDebugOverlayType,
  VisualPlacement,
  VisualState,
  VisualTerrainCell,
  VisualZone,
} from "./renderer-schema"

export type BuildDrawCommandsInput = {
  visualState: VisualState
}

export type BuildRenderableWorldSnapshotInput = {
  visualState: VisualState
}

export function buildDrawCommands(
  input: BuildDrawCommandsInput
): DrawCommand[] {
  const { visualState } = input

  return [
    ...(isOverlayEnabled(visualState, "terrain")
      ? buildTerrainCellCommands(visualState.terrainCells)
      : []),
    ...(isOverlayEnabled(visualState, "zone_bounds")
      ? buildZoneBoundsCommands(visualState.zones)
      : []),
    ...(isOverlayEnabled(visualState, "placement_anchor")
      ? buildPlacementAnchorCommands(visualState.placements)
      : []),
    ...(isOverlayEnabled(visualState, "footprint")
      ? buildPlacementFootprintCommands(visualState.placements)
      : []),
    ...(isOverlayEnabled(visualState, "collision")
      ? buildPlacementCollisionCommands(visualState.placements)
      : []),
    ...(isOverlayEnabled(visualState, "support")
      ? buildPlacementSupportCommands(visualState.placements)
      : []),
    ...(isOverlayEnabled(visualState, "influence")
      ? buildPlacementInfluenceCommands(visualState.placements)
      : []),
    ...(isOverlayEnabled(visualState, "labels")
      ? buildLabelCommands({
          zones: visualState.zones,
          placements: visualState.placements,
        })
      : []),
  ]
}

export function buildRenderableWorldSnapshot(
  input: BuildRenderableWorldSnapshotInput
): RenderableWorldSnapshot {
  return {
    visualState: input.visualState,
    drawCommands: buildDrawCommands({ visualState: input.visualState }),
    tags: [
      "renderable_world_snapshot_v0",
      "procedural_renderer_output",
      ...input.visualState.tags,
    ],
  }
}

function isOverlayEnabled(
  visualState: VisualState,
  overlayType: RendererDebugOverlayType
): boolean {
  return (
    visualState.overlays.find((overlay) => overlay.type === overlayType)
      ?.enabled ?? false
  )
}

function buildTerrainCellCommands(
  cells: VisualTerrainCell[]
): DrawCommand[] {
  return cells.map((cell) => ({
    id: `terrain-${cell.id}`,
    kind: "polygon",
    layer: "terrain",
    geometry: cellToPolygonShape(cell),
    label: cell.biome,
    debugStyle: getTerrainDebugStyle(cell),
    source: "terrain_state",
    tags: [
      ...cell.tags,
      "draw_command_v0",
      "terrain_cell",
      `biome:${cell.biome}`,
    ],
  }))
}

function buildZoneBoundsCommands(zones: VisualZone[]): DrawCommand[] {
  return zones.map((zone) => ({
    id: `zone-bounds-${zone.id}`,
    kind: "bounds",
    layer: "zone",
    geometry: boundsToPolygonShape(zone.bounds),
    label: zone.label,
    debugStyle: {
      stroke: "zone_bounds_stroke",
      fill: "zone_bounds_fill",
      opacity: 0.18,
      strokeWidth: 1,
      dash: [4, 4],
    },
    source: "home_map_state",
    tags: [
      ...zone.tags,
      "draw_command_v0",
      "zone_bounds",
      `zone_type:${zone.type}`,
    ],
  }))
}

function buildPlacementAnchorCommands(
  placements: VisualPlacement[]
): DrawCommand[] {
  return placements.map((placement) => ({
    id: `placement-anchor-${placement.placementId}`,
    kind: "point",
    layer: "placement",
    geometry: pointToShape(placement.anchor),
    label: placement.label,
    debugStyle: getPlacementAnchorDebugStyle(placement),
    source: "home_map_state",
    tags: [
      ...placement.tags,
      "draw_command_v0",
      "placement_anchor",
      `rule_status:${placement.ruleStatus}`,
      `placement_layer:${placement.layer}`,
    ],
  }))
}

function buildPlacementFootprintCommands(
  placements: VisualPlacement[]
): DrawCommand[] {
  return placements.flatMap((placement) =>
    placement.footprint
      ? [
          buildPlacementGeometryCommand({
            placement,
            shape: placement.footprint,
            idPrefix: "placement-footprint",
            labelSuffix: "footprint",
            tag: "placement_footprint",
            debugStyle: {
              stroke: "footprint_stroke",
              fill: "footprint_fill",
              opacity: 0.28,
              strokeWidth: 1,
            },
          }),
        ]
      : []
  )
}

function buildPlacementCollisionCommands(
  placements: VisualPlacement[]
): DrawCommand[] {
  return placements.flatMap((placement) =>
    placement.collision
      ? [
          buildPlacementGeometryCommand({
            placement,
            shape: placement.collision,
            idPrefix: "placement-collision",
            labelSuffix: "collision",
            tag: "placement_collision",
            debugStyle: {
              stroke: "collision_stroke",
              fill: "collision_fill",
              opacity: 0.36,
              strokeWidth: 1,
              dash: [3, 3],
            },
          }),
        ]
      : []
  )
}

function buildPlacementSupportCommands(
  placements: VisualPlacement[]
): DrawCommand[] {
  return placements.flatMap((placement) =>
    placement.support
      ? [
          buildPlacementGeometryCommand({
            placement,
            shape: placement.support,
            idPrefix: "placement-support",
            labelSuffix: "support",
            tag: "placement_support",
            debugStyle: {
              stroke: "support_stroke",
              fill: "support_fill",
              opacity: 0.3,
              strokeWidth: 1,
              dash: [5, 3],
            },
          }),
        ]
      : []
  )
}

function buildPlacementInfluenceCommands(
  placements: VisualPlacement[]
): DrawCommand[] {
  return placements.flatMap((placement) =>
    placement.influence
      ? [
          buildPlacementGeometryCommand({
            placement,
            shape: placement.influence,
            idPrefix: "placement-influence",
            labelSuffix: "influence",
            tag: "placement_influence",
            debugStyle: {
              stroke: "influence_stroke",
              fill: "influence_fill",
              opacity: 0.2,
              strokeWidth: 1,
              dash: [6, 4],
            },
          }),
        ]
      : []
  )
}

function buildPlacementGeometryCommand(input: {
  placement: VisualPlacement
  shape: SpatialShape
  idPrefix: string
  labelSuffix: string
  tag: string
  debugStyle: DrawCommandDebugStyle
}): DrawCommand {
  return {
    id: `${input.idPrefix}-${input.placement.placementId}`,
    kind: shapeKindToCommandKind(input.shape),
    layer: "geometry",
    geometry: input.shape,
    label: `${input.placement.label} ${input.labelSuffix}`,
    debugStyle: input.debugStyle,
    source: "entity_geometry",
    tags: [...input.placement.tags, "draw_command_v0", input.tag],
  }
}

function buildLabelCommands(input: {
  zones: VisualZone[]
  placements: VisualPlacement[]
}): DrawCommand[] {
  return [
    ...input.zones.map((zone) => ({
      id: `label-zone-${zone.id}`,
      kind: "label" as const,
      layer: "label" as const,
      geometry: pointToShape({
        x: zone.bounds.x + zone.bounds.width / 2,
        y: zone.bounds.y + zone.bounds.height / 2,
      }),
      label: zone.label,
      debugStyle: getLabelDebugStyle(),
      source: "home_map_state" as const,
      tags: [...zone.tags, "draw_command_v0", "label", "zone_label"],
    })),
    ...input.placements.map((placement) => ({
      id: `label-placement-${placement.placementId}`,
      kind: "label" as const,
      layer: "label" as const,
      geometry: pointToShape(placement.anchor),
      label: placement.label,
      debugStyle: getLabelDebugStyle(),
      source: "home_map_state" as const,
      tags: [...placement.tags, "draw_command_v0", "label", "placement_label"],
    })),
  ]
}

function boundsToPolygonShape(bounds: MapBounds): SpatialShape {
  const points: Polygon2D["points"] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]

  return {
    kind: "polygon",
    polygon: { points },
  }
}

function cellToPolygonShape(cell: VisualTerrainCell): SpatialShape {
  const points: Polygon2D["points"] = [
    { x: cell.x, y: cell.y },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x + 1, y: cell.y + 1 },
    { x: cell.x, y: cell.y + 1 },
  ]

  return {
    kind: "polygon",
    polygon: { points },
  }
}

function pointToShape(point: Point2D): SpatialShape {
  return {
    kind: "point",
    point,
  }
}

function shapeKindToCommandKind(shape: SpatialShape): DrawCommand["kind"] {
  if (shape.kind === "point") {
    return "point"
  }

  if (shape.kind === "line") {
    return "line"
  }

  return "polygon"
}

function getTerrainDebugStyle(
  cell: VisualTerrainCell
): DrawCommandDebugStyle {
  if (cell.biome === "grassland") {
    return {
      stroke: "terrain_grassland_stroke",
      fill: "terrain_grassland_fill",
      opacity: 0.32,
      strokeWidth: 1,
    }
  }

  if (cell.biome === "soil") {
    return {
      stroke: "terrain_soil_stroke",
      fill: "terrain_soil_fill",
      opacity: 0.32,
      strokeWidth: 1,
    }
  }

  if (cell.biome === "water") {
    return {
      stroke: "terrain_water_stroke",
      fill: "terrain_water_fill",
      opacity: 0.36,
      strokeWidth: 1,
    }
  }

  if (cell.biome === "sand") {
    return {
      stroke: "terrain_sand_stroke",
      fill: "terrain_sand_fill",
      opacity: 0.32,
      strokeWidth: 1,
    }
  }

  if (cell.biome === "stone") {
    return {
      stroke: "terrain_stone_stroke",
      fill: "terrain_stone_fill",
      opacity: 0.32,
      strokeWidth: 1,
    }
  }

  return {
    stroke: "terrain_constructed_stroke",
    fill: "terrain_constructed_fill",
    opacity: 0.38,
    strokeWidth: 1,
  }
}

function getPlacementAnchorDebugStyle(
  placement: VisualPlacement
): DrawCommandDebugStyle {
  if (placement.ruleStatus === "accepted") {
    return {
      stroke: "placement_accepted_stroke",
      fill: "placement_accepted_fill",
      opacity: 0.9,
      strokeWidth: 1,
    }
  }

  if (placement.ruleStatus === "rejected") {
    return {
      stroke: "placement_rejected_stroke",
      fill: "placement_rejected_fill",
      opacity: 0.95,
      strokeWidth: 2,
    }
  }

  if (placement.ruleStatus === "unmapped") {
    return {
      stroke: "placement_unmapped_stroke",
      fill: "placement_unmapped_fill",
      opacity: 0.75,
      strokeWidth: 1,
      dash: [2, 2],
    }
  }

  return {
    stroke: "placement_unknown_stroke",
    fill: "placement_unknown_fill",
    opacity: 0.65,
    strokeWidth: 1,
    dash: [2, 3],
  }
}

function getLabelDebugStyle(): DrawCommandDebugStyle {
  return {
    stroke: "label_stroke",
    fill: "label_fill",
    opacity: 1,
    strokeWidth: 1,
  }
}
