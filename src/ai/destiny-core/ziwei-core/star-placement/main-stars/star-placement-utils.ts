import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext,
  ZiweiStarId
} from "../../contracts"
import { getZiweiStarDefinition } from "../../star-catalog"

export function createMainPlacedStar(params: {
  context: ZiweiPlacementContext
  starId: ZiweiStarId
  branch: BranchPalace
  placementRuleId: string
  debug?: Record<string, unknown>
}): ZiweiPlacedStar {
  const definition = getZiweiStarDefinition(params.starId)

  if (!definition) {
    throw new Error(`Unknown Ziwei star id: ${params.starId}`)
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
