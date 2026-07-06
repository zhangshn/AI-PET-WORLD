import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { YEARLY_STAR_IDS } from "../../star-catalog"

import {
  createYearlyPlacedStar,
  requireYearBranch
} from "./yearly-placement-utils"

export const SUIQIAN_SEQUENCE = [
  YEARLY_STAR_IDS.suijian,
  YEARLY_STAR_IDS.huiqi,
  YEARLY_STAR_IDS.sangmen,
  YEARLY_STAR_IDS.guansuo,
  YEARLY_STAR_IDS.suiGuanfu,
  YEARLY_STAR_IDS.suiXiaohao,
  YEARLY_STAR_IDS.suiDahao,
  YEARLY_STAR_IDS.longde,
  YEARLY_STAR_IDS.baihu,
  YEARLY_STAR_IDS.tiande,
  YEARLY_STAR_IDS.diaoke,
  YEARLY_STAR_IDS.suiBingfu
]

export function placeSuiqianCycleStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const startBranch = requireYearBranch(
    context,
    "yearly.suiqian.year-branch-forward"
  )

  return SUIQIAN_SEQUENCE.map((starId, index) => {
    return createYearlyPlacedStar({
      context,
      starId,
      branch: moveBranch(startBranch, index),
      placementRuleId: "yearly.suiqian.year-branch-forward",
      debug: {
        yearBranch: startBranch,
        startBranch,
        sequenceIndex: index
      }
    })
  })
}
