/**
 * 当前文件职责：将世界变化计划转换为世界变化提案。
 */

import { createAddPlacementDiff } from "@/world/map-state/map-diff-engine"
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

  if (input.plan.type !== "plant_nature") {
    return buildNoDiffProposal({
      input,
      reason: "该计划类型本轮暂不生成地图变化。",
      warnings: ["该计划类型尚未接入 MapDiff 生成。"],
    })
  }

  return buildPlantNatureDiffProposal(input)
}

function buildPlantNatureDiffProposal(
  input: BuildWorldDiffProposalInput
): WorldDiffProposal {
  const zone = input.homeMapState.zones.find(
    (homeZone) => homeZone.type === input.plan.target.zoneType
  )

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
      tags: ["world_evolution_v0", "intent_generated", "plant_nature"],
    },
    reason: "世界变化计划生成：管家倾向于增加自然细节。",
    createdAt: input.now,
    tags: ["world_evolution_v0", "map_diff_proposal", "plant_nature"],
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
      `plan_type:${input.input.plan.type}`,
      `proposal_type:${input.mapDiffs.length > 0 ? "map_diff" : input.type}`,
    ],
  }
}
