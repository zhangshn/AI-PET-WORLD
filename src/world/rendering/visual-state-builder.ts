/**
 * 当前文件职责：从世界状态派生 ProceduralRenderer v0 的 VisualState。
 */

import { buildEntityGeometryFromPlacement } from "@/world/geometry-adapters/geometry-adapter-gateway"
import type {
  PlacementGeometryAuditItem,
  PlacementGeometryAuditReport,
} from "@/world/geometry-audit/geometry-audit-gateway"
import type {
  EnvironmentState,
  TerrainCellState,
} from "@/world/environment/environment-gateway"
import type {
  HomeMapState,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"

import {
  DEFAULT_RENDERER_DEBUG_OVERLAYS,
  type VisualPlacement,
  type VisualRuleStatus,
  type VisualState,
  type VisualTerrainCell,
  type VisualZone,
} from "./renderer-schema"

export type BuildVisualStateInput = {
  homeMapState: HomeMapState
  environmentState: EnvironmentState
  placementGeometryAudit: PlacementGeometryAuditReport
  generatedAt?: number
}

export function buildVisualState(input: BuildVisualStateInput): VisualState {
  return {
    worldId: input.homeMapState.worldId,
    mapSize: input.homeMapState.mapSize,
    zones: buildVisualZones(input.homeMapState),
    placements: buildVisualPlacements({
      homeMapState: input.homeMapState,
      placementGeometryAudit: input.placementGeometryAudit,
    }),
    terrainCells: buildVisualTerrainCells(input.environmentState),
    overlays: DEFAULT_RENDERER_DEBUG_OVERLAYS,
    generatedAt: input.generatedAt ?? input.homeMapState.updatedAt,
    sources: [
      "home_map_state",
      "entity_geometry",
      "terrain_state",
      "placement_geometry_audit",
    ],
    tags: [
      "visual_state_v0",
      "procedural_renderer_input",
      ...input.homeMapState.tags,
    ],
  }
}

function buildVisualZones(homeMapState: HomeMapState): VisualZone[] {
  return homeMapState.zones.map((zone) => ({
    id: zone.id,
    type: zone.type,
    label: zone.name,
    bounds: zone.bounds,
    tags: zone.tags,
  }))
}

function buildVisualPlacements(input: {
  homeMapState: HomeMapState
  placementGeometryAudit: PlacementGeometryAuditReport
}): VisualPlacement[] {
  return input.homeMapState.placements.map((placement) =>
    buildVisualPlacement({
      placement,
      auditItem: input.placementGeometryAudit.items.find(
        (item) => item.placementId === placement.id
      ),
      tileSize: input.homeMapState.mapSize.tileSize,
    })
  )
}

function buildVisualPlacement(input: {
  placement: MapPlacement
  auditItem: PlacementGeometryAuditItem | undefined
  tileSize: number
}): VisualPlacement {
  const ruleStatus = buildRuleStatus(input.auditItem)
  const ruleMessage = buildRuleMessage(input.auditItem)

  try {
    const geometry = buildEntityGeometryFromPlacement({
      placement: input.placement,
      tileSize: input.tileSize,
    })

    return {
      placementId: input.placement.id,
      assetId: String(input.placement.assetId),
      label: input.placement.label,
      anchor: geometry.anchor,
      layer: input.placement.layer,
      footprint: geometry.footprint,
      collision: geometry.collision,
      support: geometry.support,
      influence: geometry.influence,
      ruleStatus,
      ruleMessage,
      alpha: input.placement.alpha,
      scale: input.placement.scale,
      tags: [
        ...input.placement.tags,
        `visual_rule:${ruleStatus}`,
        `placement_layer:${input.placement.layer}`,
      ],
    }
  } catch {
    return {
      placementId: input.placement.id,
      assetId: String(input.placement.assetId),
      label: input.placement.label,
      anchor: {
        x: input.placement.x,
        y: input.placement.y,
      },
      layer: input.placement.layer,
      ruleStatus,
      ruleMessage: input.auditItem ? ruleMessage : "无法生成 EntityGeometry。",
      alpha: input.placement.alpha,
      scale: input.placement.scale,
      tags: [
        ...input.placement.tags,
        `visual_rule:${ruleStatus}`,
        `placement_layer:${input.placement.layer}`,
        "visual_geometry_failed",
      ],
    }
  }
}

function buildRuleStatus(
  auditItem: PlacementGeometryAuditItem | undefined
): VisualRuleStatus {
  if (!auditItem) {
    return "unknown"
  }

  if (auditItem.objectType === null) {
    return "unmapped"
  }

  if (auditItem.ruleAccepted) {
    return "accepted"
  }

  return "rejected"
}

function buildRuleMessage(
  auditItem: PlacementGeometryAuditItem | undefined
): string {
  return auditItem?.ruleMessage ?? "未找到 placement 几何审计结果。"
}

function buildVisualTerrainCells(
  environmentState: EnvironmentState
): VisualTerrainCell[] {
  return Object.values(environmentState.terrain.cells)
    .sort(sortTerrainCells)
    .map((cell) => ({
      id: `${cell.x}_${cell.y}`,
      x: cell.x,
      y: cell.y,
      biome: cell.biome,
      moisture: cell.moisture,
      fertility: cell.fertility,
      sunlight: cell.sunlight,
      tags: cell.tags,
    }))
}

function sortTerrainCells(
  left: TerrainCellState,
  right: TerrainCellState
): number {
  if (left.y !== right.y) {
    return left.y - right.y
  }

  return left.x - right.x
}
