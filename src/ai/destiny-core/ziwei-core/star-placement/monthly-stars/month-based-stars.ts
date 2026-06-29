import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { MONTHLY_STAR_IDS } from "../../star-catalog"

import { createMonthlyPlacedStar } from "./monthly-placement-utils"

const YUEJIE_BY_MONTH: Record<number, BranchPalace> = {
  1: "shen",
  2: "shen",
  3: "xu",
  4: "xu",
  5: "zi",
  6: "zi",
  7: "yin",
  8: "yin",
  9: "chen",
  10: "chen",
  11: "wu",
  12: "wu"
}

const TIANWU_BY_MONTH: Record<number, BranchPalace> = {
  1: "si",
  2: "shen",
  3: "yin",
  4: "hai",
  5: "si",
  6: "shen",
  7: "yin",
  8: "hai",
  9: "si",
  10: "shen",
  11: "yin",
  12: "hai"
}

const TIANYUE_BY_MONTH: Record<number, BranchPalace> = {
  1: "xu",
  2: "si",
  3: "chen",
  4: "yin",
  5: "wei",
  6: "mao",
  7: "hai",
  8: "wei",
  9: "yin",
  10: "wu",
  11: "xu",
  12: "yin"
}

const YINSHA_BY_MONTH: Record<number, BranchPalace> = {
  1: "yin",
  2: "zi",
  3: "xu",
  4: "shen",
  5: "wu",
  6: "chen",
  7: "yin",
  8: "zi",
  9: "xu",
  10: "shen",
  11: "wu",
  12: "chen"
}

export function placeMonthBasedStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const lunarMonth = context.lunarInfo.lunarMonth

  return [
    createMonthLookupStar({
      context,
      lunarMonth,
      starId: MONTHLY_STAR_IDS.yuejie,
      table: YUEJIE_BY_MONTH,
      placementRuleId: "monthly.yuejie.lunar-month"
    }),
    createMonthLookupStar({
      context,
      lunarMonth,
      starId: MONTHLY_STAR_IDS.tianwu,
      table: TIANWU_BY_MONTH,
      placementRuleId: "monthly.tianwu.lunar-month"
    }),
    createMonthLookupStar({
      context,
      lunarMonth,
      starId: MONTHLY_STAR_IDS.tianyue,
      table: TIANYUE_BY_MONTH,
      placementRuleId: "monthly.tianyue.lunar-month"
    }),
    createMonthLookupStar({
      context,
      lunarMonth,
      starId: MONTHLY_STAR_IDS.yinsha,
      table: YINSHA_BY_MONTH,
      placementRuleId: "monthly.yinsha.lunar-month"
    })
  ]
}

function createMonthLookupStar(params: {
  context: ZiweiPlacementContext
  lunarMonth: number
  starId: string
  table: Record<number, BranchPalace>
  placementRuleId: string
}): ZiweiPlacedStar {
  const branch = params.table[params.lunarMonth]

  if (!branch) {
    throw new Error(
      `${params.placementRuleId} received invalid lunar month: ${params.lunarMonth}`
    )
  }

  return createMonthlyPlacedStar({
    context: params.context,
    starId: params.starId,
    branch,
    placementRuleId: params.placementRuleId,
    debug: {
      lunarMonth: params.lunarMonth
    }
  })
}
