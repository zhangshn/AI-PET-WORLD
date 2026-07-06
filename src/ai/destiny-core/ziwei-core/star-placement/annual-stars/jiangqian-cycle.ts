import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { YEARLY_STAR_IDS } from "../../star-catalog"

import {
  createYearlyPlacedStar,
  requireYearBranch
} from "./yearly-placement-utils"

export const JIANGQIAN_SEQUENCE = [
  YEARLY_STAR_IDS.jiangxing,
  YEARLY_STAR_IDS.panan,
  YEARLY_STAR_IDS.suiyi,
  YEARLY_STAR_IDS.xishenRest,
  YEARLY_STAR_IDS.huagai,
  YEARLY_STAR_IDS.jiesha,
  YEARLY_STAR_IDS.zaisha,
  YEARLY_STAR_IDS.tiansha,
  YEARLY_STAR_IDS.zhibei,
  YEARLY_STAR_IDS.xianchi,
  YEARLY_STAR_IDS.yuesha,
  YEARLY_STAR_IDS.wangshen
]

export const JIANGXING_START_BY_YEAR_BRANCH: Record<BranchPalace, BranchPalace> = {
  yin: "wu",
  wu: "wu",
  xu: "wu",
  shen: "zi",
  zi: "zi",
  chen: "zi",
  si: "you",
  you: "you",
  chou: "you",
  hai: "mao",
  mao: "mao",
  wei: "mao"
}

export function placeJiangqianCycleStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const yearBranch = requireYearBranch(
    context,
    "yearly.jiangqian.trine-start-forward"
  )
  const startBranch = JIANGXING_START_BY_YEAR_BRANCH[yearBranch]

  return JIANGQIAN_SEQUENCE.map((starId, index) => {
    return createYearlyPlacedStar({
      context,
      starId,
      branch: moveBranch(startBranch, index),
      placementRuleId: "yearly.jiangqian.trine-start-forward",
      debug: {
        yearBranch,
        startBranch,
        sequenceIndex: index
      }
    })
  })
}
