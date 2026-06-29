import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { MALEFIC_STAR_IDS } from "../../star-catalog"
import { getLucunBranch } from "../assistant-stars/lucun-tianma"

import { createMaleficPlacedStar } from "./malefic-placement-utils"

export function placeQingyangTuoluoStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const lucunBranch = getLucunBranch(context.lunarInfo.yearStem)

  return [
    createMaleficPlacedStar({
      context,
      starId: MALEFIC_STAR_IDS.qingyang,
      branch: moveBranch(lucunBranch, 1),
      placementRuleId: "malefic.qingyang-tuoluo.lucun-neighbors",
      debug: {
        yearStem: context.lunarInfo.yearStem,
        lucunBranch,
        offsetFromLucun: 1
      }
    }),
    createMaleficPlacedStar({
      context,
      starId: MALEFIC_STAR_IDS.tuoluo,
      branch: moveBranch(lucunBranch, -1),
      placementRuleId: "malefic.qingyang-tuoluo.lucun-neighbors",
      debug: {
        yearStem: context.lunarInfo.yearStem,
        lucunBranch,
        offsetFromLucun: -1
      }
    })
  ]
}
