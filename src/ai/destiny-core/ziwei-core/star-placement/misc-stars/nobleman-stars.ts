import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { TIME_BRANCH_ORDER, moveBranch } from "../../shared"
import { MISC_STAR_IDS } from "../../star-catalog"

import { createMiscPlacedStar } from "./misc-placement-utils"

const TIANWU_BY_LUNAR_MONTH: Record<number, BranchPalace> = {
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

export function placeNoblemanStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const yearBranch = context.lunarInfo.yearBranch

  if (!yearBranch) {
    throw new Error("Missing lunar year branch for nobleman star placement.")
  }

  const timeOffset = context.lunarInfo.timeBranchNumber - 1
  const yearOffset = getYearBranchOffset(yearBranch)

  return [
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.taifu,
      branch: moveBranch("wu", timeOffset),
      placementRuleId: "misc.nobleman.taifu.time-branch",
      debug: {
        timeBranch: context.lunarInfo.timeBranch,
        startBranch: "wu",
        direction: "forward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.fenggao,
      branch: moveBranch("yin", timeOffset),
      placementRuleId: "misc.nobleman.fenggao.time-branch",
      debug: {
        timeBranch: context.lunarInfo.timeBranch,
        startBranch: "yin",
        direction: "forward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.longchi,
      branch: moveBranch("chen", yearOffset),
      placementRuleId: "misc.nobleman.longchi.year-branch",
      debug: {
        yearBranch,
        startBranch: "chen",
        direction: "forward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.fengge,
      branch: moveBranch("xu", -yearOffset),
      placementRuleId: "misc.nobleman.fengge.year-branch",
      debug: {
        yearBranch,
        startBranch: "xu",
        direction: "backward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.tianwu,
      branch: getTianwuBranch(context.lunarInfo.lunarMonth),
      placementRuleId: "misc.nobleman.tianwu.lunar-month",
      debug: {
        lunarMonth: context.lunarInfo.lunarMonth
      }
    })
  ]
}

function getYearBranchOffset(yearBranch: BranchPalace): number {
  const offset = TIME_BRANCH_ORDER.indexOf(yearBranch)

  if (offset < 0) {
    throw new Error(`Unknown lunar year branch: ${yearBranch}`)
  }

  return offset
}

function getTianwuBranch(lunarMonth: number): BranchPalace {
  const branch = TIANWU_BY_LUNAR_MONTH[lunarMonth]

  if (!branch) {
    throw new Error(`Unknown lunar month for Tianwu: ${lunarMonth}`)
  }

  return branch
}
