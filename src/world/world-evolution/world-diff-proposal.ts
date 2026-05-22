/**
 * 当前文件职责：将世界变化计划转换为世界变化提案。
 */

import {
  createAddPlacementDiff,
  createRemovePlacementDiff,
  createUpdatePlacementDiff,
} from "@/world/map-state/map-diff-engine"
import type {
  HomeMapState,
  HomeZone,
  MapCoordinate,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import type {
  BuildWorldDiffProposalInput,
  WorldDiffProposal,
  WorldDiffProposalType,
} from "./world-evolution-schema"

export function buildWorldDiffProposal(
  input: BuildWorldDiffProposalInput
): WorldDiffProposal {
  if (!input.plan.shouldGenerateDiff) {
    return buildNoDiffProposal({
      input,
      reason: "该世界变化计划不需要生成地图变化提案。",
      warnings: [],
    })
  }

  if (input.plan.status !== "proposed") {
    return buildNoDiffProposal({
      input,
      reason: "该世界变化计划尚未进入 proposed 状态。",
      warnings: [],
    })
  }

  if (input.plan.type === "plant_nature") {
    return buildPlantNatureDiffProposal(input)
  }

  if (input.plan.type === "build_path") {
    return buildPathDiffProposal(input)
  }

  if (input.plan.type === "clean_area") {
    return buildCleanAreaDiffProposal(input)
  }

  if (input.plan.type === "repair_facility") {
    return buildRepairFacilityDiffProposal(input)
  }

  return buildNoDiffProposal({
    input,
    reason: "该计划类型本轮暂不生成地图变化。",
    warnings: ["该计划类型尚未接入 MapDiff 生成。"],
  })
}

function buildPlantNatureDiffProposal(
  input: BuildWorldDiffProposalInput
): WorldDiffProposal {
  const zone = findTargetZone(input.homeMapState, input.plan.target.zoneType)

  if (!zone) {
    return buildNoDiffProposal({
      input,
      reason: "无法生成自然细节变化提案。",
      warnings: ["未找到目标区域"],
    })
  }

  const x = Math.floor(zone.bounds.x + zone.bounds.width / 2)
  const y = Math.floor(zone.bounds.y + zone.bounds.height / 2)
  const placementId = `world-evolution-plant-nature-${input.now}`
  const mapDiff = createAddPlacementDiff({
    id: `map-diff-${placementId}`,
    placementId,
    placement: {
      id: placementId,
      assetId: "surfaceFlowerPatch01",
      x,
      y,
      layer: "surface-decoration",
      scale: 1,
      alpha: 1,
      label: "世界变化：自然细节",
      source: "construction_plan",
      tags: ["world_evolution_v1", "intent_generated", "plant_nature"],
    },
    reason: "世界变化计划生成：管家倾向于增加自然细节。",
    createdAt: input.now,
    tags: ["world_evolution_v1", "map_diff_proposal", "plant_nature"],
  })

  return buildProposal({
    input,
    type: "map_diff",
    mapDiffs: [mapDiff],
    acceptedForPlanning: true,
    reason: "世界变化计划生成：管家倾向于增加自然细节。",
    warnings: [],
  })
}

function buildPathDiffProposal(
  input: BuildWorldDiffProposalInput
): WorldDiffProposal {
  const zone = findTargetZone(input.homeMapState, input.plan.target.zoneType)

  if (!zone) {
    return buildNoDiffProposal({
      input,
      reason: "无法生成路径变化提案。",
      warnings: ["未找到目标区域"],
    })
  }

  const point = findAvailablePointInZone({
    homeMapState: input.homeMapState,
    zone,
    preferredOffset: { x: 1, y: 0 },
  })

  if (!point) {
    return buildNoDiffProposal({
      input,
      reason: "无法生成路径变化提案。",
      warnings: ["目标区域没有可用路径坐标"],
    })
  }

  const placementId = `world-evolution-build-path-${input.now}`
  const mapDiff = createAddPlacementDiff({
    id: `map-diff-${placementId}`,
    placementId,
    placement: {
      id: placementId,
      assetId: "pathDirtHorizontal01",
      x: point.x,
      y: point.y,
      layer: "path",
      scale: 1,
      alpha: 1,
      label: "世界变化：新路径",
      source: "construction_plan",
      tags: [
        "world_evolution_v1",
        "intent_generated",
        "build_path",
        "path",
      ],
    },
    reason: "世界变化计划生成：管家优化家园内部通行路径。",
    createdAt: input.now,
    tags: ["world_evolution_v1", "map_diff_proposal", "build_path"],
  })

  return buildProposal({
    input,
    type: "map_diff",
    mapDiffs: [mapDiff],
    acceptedForPlanning: true,
    reason: "世界变化计划生成：管家优化家园内部通行路径。",
    warnings: [],
  })
}

function buildCleanAreaDiffProposal(
  input: BuildWorldDiffProposalInput
): WorldDiffProposal {
  const placement = findCleanablePlacement(input.homeMapState)

  if (!placement) {
    return buildNoDiffProposal({
      input,
      reason: "无法生成清理变化提案。",
      warnings: ["没有找到可清理对象"],
    })
  }

  const mapDiff = createRemovePlacementDiff({
    id: `map-diff-clean-area-${placement.id}-${input.now}`,
    placementId: placement.id,
    reason: "世界变化计划生成：管家清理家园中的杂乱区域。",
    createdAt: input.now,
    tags: [
      "world_evolution_v1",
      "map_diff_proposal",
      "clean_area",
      "remove_surface_decoration",
    ],
  })

  return buildProposal({
    input,
    type: "map_diff",
    mapDiffs: [mapDiff],
    acceptedForPlanning: true,
    reason: "世界变化计划生成：管家清理家园中的杂乱区域。",
    warnings: [],
  })
}

function buildRepairFacilityDiffProposal(
  input: BuildWorldDiffProposalInput
): WorldDiffProposal {
  const placement = findRepairableFacility(input.homeMapState)

  if (!placement) {
    return buildNoDiffProposal({
      input,
      reason: "无法生成设施修复变化提案。",
      warnings: ["没有找到可修复设施"],
    })
  }

  const mapDiff = createUpdatePlacementDiff({
    id: `map-diff-repair-facility-${placement.id}-${input.now}`,
    placementId: placement.id,
    patch: {
      label: `${placement.label}（已维护）`,
      alpha: Math.min(1, placement.alpha + 0.05),
      scale: placement.scale,
      tags: Array.from(
        new Set([
          ...placement.tags,
          "world_evolution_v1",
          "repair_facility",
          "maintained",
        ])
      ),
    },
    reason: "世界变化计划生成：管家修复或维护照护设施。",
    createdAt: input.now,
    tags: [
      "world_evolution_v1",
      "map_diff_proposal",
      "repair_facility",
      "update_facility",
    ],
  })

  return buildProposal({
    input,
    type: "map_diff",
    mapDiffs: [mapDiff],
    acceptedForPlanning: true,
    reason: "世界变化计划生成：管家修复或维护照护设施。",
    warnings: [],
  })
}

function buildNoDiffProposal(input: {
  input: BuildWorldDiffProposalInput
  reason: string
  warnings: string[]
}): WorldDiffProposal {
  return buildProposal({
    input: input.input,
    type: "no_diff",
    acceptedForPlanning: false,
    mapDiffs: [],
    reason: input.reason,
    warnings: input.warnings,
  })
}

function buildProposal(input: {
  input: BuildWorldDiffProposalInput
  type: WorldDiffProposalType
  acceptedForPlanning: boolean
  mapDiffs: WorldDiffProposal["mapDiffs"]
  reason: string
  warnings: string[]
}): WorldDiffProposal {
  return {
    id: `world-diff-proposal-${input.input.now}-${input.input.plan.id}`,
    type: input.mapDiffs.length > 0 ? "map_diff" : input.type,
    planId: input.input.plan.id,
    acceptedForPlanning: input.mapDiffs.length > 0
      ? true
      : input.acceptedForPlanning,
    mapDiffs: input.mapDiffs,
    reason: input.reason,
    warnings: input.warnings,
    tags: [
      "world_diff_proposal_v0",
      "world_diff_proposal_v1",
      `plan_type:${input.input.plan.type}`,
      `proposal_type:${input.mapDiffs.length > 0 ? "map_diff" : input.type}`,
      `plan_priority:${input.input.plan.priority}`,
      `plan_scope:${input.input.plan.scope}`,
      ...input.input.plan.riskHints.map((hint) => `risk_hint:${hint}`),
    ],
  }
}

function findTargetZone(
  homeMapState: HomeMapState,
  zoneType: BuildWorldDiffProposalInput["plan"]["target"]["zoneType"]
): HomeZone | undefined {
  if (!zoneType) return undefined

  return homeMapState.zones.find((zone) => zone.type === zoneType)
}

function findAvailablePointInZone(input: {
  homeMapState: HomeMapState
  zone: HomeZone
  preferredOffset: MapCoordinate
}): MapCoordinate | undefined {
  const centerX = Math.floor(input.zone.bounds.x + input.zone.bounds.width / 2)
  const centerY = Math.floor(input.zone.bounds.y + input.zone.bounds.height / 2)
  const offsets: MapCoordinate[] = [
    input.preferredOffset,
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 2, y: 0 },
    { x: -2, y: 0 },
  ]

  return offsets
    .map((offset) => ({
      x: centerX + offset.x,
      y: centerY + offset.y,
    }))
    .find(
      (point) =>
        isInsideMap(input.homeMapState, point) &&
        !hasBlockingPlacementAtPoint(input.homeMapState, point)
    )
}

function isInsideMap(
  homeMapState: HomeMapState,
  point: MapCoordinate
): boolean {
  return (
    point.x >= 1 &&
    point.y >= 1 &&
    point.x <= homeMapState.mapSize.columns &&
    point.y <= homeMapState.mapSize.rows
  )
}

function hasBlockingPlacementAtPoint(
  homeMapState: HomeMapState,
  point: MapCoordinate
): boolean {
  return homeMapState.placements.some((placement) => {
    if (placement.x !== point.x || placement.y !== point.y) return false

    return (
      placement.layer === "structure" ||
      placement.layer === "facility" ||
      placement.layer === "nature" ||
      placement.layer === "actor" ||
      placement.layer === "path"
    )
  })
}

function findCleanablePlacement(
  homeMapState: HomeMapState
): MapPlacement | undefined {
  const cleanablePlacements = homeMapState.placements.filter(
    (placement) =>
      placement.layer === "surface-decoration" && !isProtectedPlacement(placement)
  )
  const preferredPlacement = cleanablePlacements.find((placement) =>
    hasAnyTag({
      tags: placement.tags,
      candidates: ["clutter", "fallen_leaf", "cleanup", "natural_detail"],
    })
  )

  return preferredPlacement ?? cleanablePlacements[0]
}

function findRepairableFacility(
  homeMapState: HomeMapState
): MapPlacement | undefined {
  const facilityPlacements = homeMapState.placements.filter(
    (placement) => placement.layer === "facility"
  )
  const preferredPlacement = facilityPlacements.find((placement) =>
    hasAnyTag({
      tags: placement.tags,
      candidates: ["care", "maintenance", "repairable"],
    })
  )

  return preferredPlacement ?? facilityPlacements[0]
}

function isProtectedPlacement(placement: MapPlacement): boolean {
  return hasAnyTag({
    tags: placement.tags,
    candidates: [
      "core_living",
      "entry_focus",
      "temporary_shelter",
      "butler",
      "actor",
    ],
  })
}

function hasAnyTag(input: { tags: string[]; candidates: string[] }): boolean {
  return input.candidates.some((tag) => input.tags.includes(tag))
}
