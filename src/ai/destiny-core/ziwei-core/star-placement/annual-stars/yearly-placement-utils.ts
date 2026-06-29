import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext,
  ZiweiStarId
} from "../../contracts"
import { getZiweiStarDefinition } from "../../star-catalog"

export function requireYearBranch(
  context: ZiweiPlacementContext,
  placementRuleId: string
): BranchPalace {
  if (!context.lunarInfo.yearBranch) {
    throw new Error(`${placementRuleId} requires lunarInfo.yearBranch`)
  }

  return context.lunarInfo.yearBranch
}

export function createYearlyPlacedStar(params: {
  context: ZiweiPlacementContext
  starId: ZiweiStarId
  branch: BranchPalace
  placementRuleId: string
  debug?: Record<string, unknown>
}): ZiweiPlacedStar {
  const definition = getZiweiStarDefinition(params.starId)

  if (!definition) {
    throw new Error(`Unknown Ziwei yearly star id: ${params.starId}`)
  }

  return {
    starId: definition.starId,
    label: definition.label,
    category: definition.category,
    branch: params.branch,
    sectorName: params.context.foundation.branchToSectorMap[params.branch],
    source: "natal",
    placementRuleId: params.placementRuleId,
    debug: params.debug
  }
}
