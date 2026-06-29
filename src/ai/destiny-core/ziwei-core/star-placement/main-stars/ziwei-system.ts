import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { getBranchByIndex } from "../../shared"
import { MAIN_STAR_IDS } from "../../star-catalog"

import { createMainPlacedStar } from "./star-placement-utils"

export function placeZiweiSystemStars(params: {
  context: ZiweiPlacementContext
  ziweiIndex: number
}): ZiweiPlacedStar[] {
  const placements = [
    { starId: MAIN_STAR_IDS.ziwei, index: params.ziweiIndex },
    { starId: MAIN_STAR_IDS.tianji, index: params.ziweiIndex - 1 },
    { starId: MAIN_STAR_IDS.taiyang, index: params.ziweiIndex - 3 },
    { starId: MAIN_STAR_IDS.wuqu, index: params.ziweiIndex - 4 },
    { starId: MAIN_STAR_IDS.tiantong, index: params.ziweiIndex - 5 },
    { starId: MAIN_STAR_IDS.lianzhen, index: params.ziweiIndex - 8 }
  ]

  return placements.map((placement) => {
    return createMainPlacedStar({
      context: params.context,
      starId: placement.starId,
      branch: getBranchByIndex(placement.index),
      placementRuleId: "main.ziwei-system",
      debug: {
        ziweiIndex: params.ziweiIndex,
        offsetIndex: placement.index
      }
    })
  })
}
