import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { MALEFIC_STAR_IDS } from "../../star-catalog"

import { createMaleficPlacedStar } from "./malefic-placement-utils"

export function placeDikongDijieStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const timeOffset = context.lunarInfo.timeBranchNumber - 1

  return [
    createMaleficPlacedStar({
      context,
      starId: MALEFIC_STAR_IDS.dikong,
      branch: moveBranch("hai", -timeOffset),
      placementRuleId: "malefic.dikong-dijie.time-branch",
      debug: {
        timeBranch: context.lunarInfo.timeBranch,
        timeBranchNumber: context.lunarInfo.timeBranchNumber,
        startBranch: "hai",
        direction: "backward"
      }
    }),
    createMaleficPlacedStar({
      context,
      starId: MALEFIC_STAR_IDS.dijie,
      branch: moveBranch("hai", timeOffset),
      placementRuleId: "malefic.dikong-dijie.time-branch",
      debug: {
        timeBranch: context.lunarInfo.timeBranch,
        timeBranchNumber: context.lunarInfo.timeBranchNumber,
        startBranch: "hai",
        direction: "forward"
      }
    })
  ]
}
