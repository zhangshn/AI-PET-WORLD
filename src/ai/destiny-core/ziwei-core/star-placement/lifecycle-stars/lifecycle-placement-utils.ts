import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext,
  ZiweiStarId
} from "../../contracts"
import { getZiweiStarDefinition } from "../../star-catalog"

export function createLifecyclePlacedStar(params: {
  context: ZiweiPlacementContext
  starId: ZiweiStarId
  branch: BranchPalace
  placementRuleId: string
  debug?: Record<string, unknown>
}): ZiweiPlacedStar {
  const definition = getZiweiStarDefinition(params.starId)

  if (!definition) {
    throw new Error(`Unknown Ziwei lifecycle star id: ${params.starId}`)
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
