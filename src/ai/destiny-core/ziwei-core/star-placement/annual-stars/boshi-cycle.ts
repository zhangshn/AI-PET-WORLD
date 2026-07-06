import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { YEARLY_STAR_IDS } from "../../star-catalog"
import { getLucunBranch } from "../assistant-stars/lucun-tianma"
import {
  getDirectionStep,
  resolveZiweiPlacementDirection
} from "../cycle-direction"

import { createYearlyPlacedStar } from "./yearly-placement-utils"

export const BOSHI_SEQUENCE = [
  YEARLY_STAR_IDS.boshi,
  YEARLY_STAR_IDS.lishi,
  YEARLY_STAR_IDS.qinglong,
  YEARLY_STAR_IDS.xiaohao,
  YEARLY_STAR_IDS.jiangjun,
  YEARLY_STAR_IDS.zoushu,
  YEARLY_STAR_IDS.feilian,
  YEARLY_STAR_IDS.xishen,
  YEARLY_STAR_IDS.bingfu,
  YEARLY_STAR_IDS.dahao,
  YEARLY_STAR_IDS.fubing,
  YEARLY_STAR_IDS.guanfu
]

export function placeBoshiCycleStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const direction = resolveZiweiPlacementDirection({
    yearStem: context.lunarInfo.yearStem,
    gender: context.input.gender
  })
  const step = getDirectionStep(direction)
  const lucunBranch = getLucunBranch(context.lunarInfo.yearStem)

  return BOSHI_SEQUENCE.map((starId, index) => {
    return createYearlyPlacedStar({
      context,
      starId,
      branch: moveBranch(lucunBranch, index * step),
      placementRuleId: "yearly.boshi.lucun-direction",
      debug: {
        yearStem: context.lunarInfo.yearStem,
        gender: context.input.gender,
        lucunBranch,
        direction,
        sequenceIndex: index
      }
    })
  })
}
