import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { getBranchByIndex } from "../../shared"
import { MAIN_STAR_IDS } from "../../star-catalog"

import { createMainPlacedStar } from "./star-placement-utils"

export function placeTianfuSystemStars(params: {
  context: ZiweiPlacementContext
  tianfuIndex: number
}): ZiweiPlacedStar[] {
  const placements = [
    { starId: MAIN_STAR_IDS.tianfu, index: params.tianfuIndex },
    { starId: MAIN_STAR_IDS.taiyin, index: params.tianfuIndex + 1 },
    { starId: MAIN_STAR_IDS.tanlang, index: params.tianfuIndex + 2 },
    { starId: MAIN_STAR_IDS.jumen, index: params.tianfuIndex + 3 },
    { starId: MAIN_STAR_IDS.tianxiang, index: params.tianfuIndex + 4 },
    { starId: MAIN_STAR_IDS.tianliang, index: params.tianfuIndex + 5 },
    { starId: MAIN_STAR_IDS.qisha, index: params.tianfuIndex + 6 },
    { starId: MAIN_STAR_IDS.pojun, index: params.tianfuIndex + 10 }
  ]

  return placements.map((placement) => {
    return createMainPlacedStar({
      context: params.context,
      starId: placement.starId,
      branch: getBranchByIndex(placement.index),
      placementRuleId: "main.tianfu-system",
      debug: {
        tianfuIndex: params.tianfuIndex,
        offsetIndex: placement.index
      }
    })
  })
}
