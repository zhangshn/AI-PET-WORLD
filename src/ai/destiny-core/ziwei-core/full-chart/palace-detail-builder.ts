import type {
  BranchPalace,
  FullZiweiPalace,
  ZiweiNatalFoundation,
  ZiweiPlacedStar
} from "../contracts"

import { getOppositeBranch, PHYSICAL_BRANCH_ORDER, moveBranch } from "../shared"

import { groupPalaceStarsByCategory } from "./palace-star-groups"

export function buildFullZiweiPalaces(params: {
  foundation: ZiweiNatalFoundation
  placedStars: ZiweiPlacedStar[]
}): FullZiweiPalace[] {
  return PHYSICAL_BRANCH_ORDER.map((branch) => {
    const stars = params.placedStars.filter((star) => star.branch === branch)

    return buildFullZiweiPalace({
      branch,
      foundation: params.foundation,
      placedStars: stars
    })
  })
}

function buildFullZiweiPalace(params: {
  branch: BranchPalace
  foundation: ZiweiNatalFoundation
  placedStars: ZiweiPlacedStar[]
}): FullZiweiPalace {
  const oppositeBranch = getOppositeBranch(params.branch)

  return {
    branch: params.branch,
    sectorName: params.foundation.branchToSectorMap[params.branch],
    palaceStem: params.foundation.palaceStemMap[params.branch],
    isLifePalace: params.branch === params.foundation.lifePalace,
    isBodyPalace: params.branch === params.foundation.bodyPalace,
    oppositeBranch,
    trineBranches: [
      moveBranch(params.branch, 4),
      moveBranch(params.branch, 8)
    ],
    stars: groupPalaceStarsByCategory(params.placedStars),
    detailLines: []
  }
}
