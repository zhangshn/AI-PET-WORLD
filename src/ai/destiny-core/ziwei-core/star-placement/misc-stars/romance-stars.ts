import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import {
  TIME_BRANCH_ORDER,
  getOppositeBranch,
  moveBranch
} from "../../shared"
import { MISC_STAR_IDS } from "../../star-catalog"

import { createMiscPlacedStar } from "./misc-placement-utils"

const XIANCHI_BY_YEAR_BRANCH_GROUP: Array<{
  branches: BranchPalace[]
  xianchi: BranchPalace
}> = [
  { branches: ["zi", "chen", "shen"], xianchi: "you" },
  { branches: ["chou", "si", "you"], xianchi: "wu" },
  { branches: ["yin", "wu", "xu"], xianchi: "mao" },
  { branches: ["mao", "wei", "hai"], xianchi: "zi" }
]

export function placeRomanceStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const yearBranch = context.lunarInfo.yearBranch

  if (!yearBranch) {
    throw new Error("Missing lunar year branch for romance star placement.")
  }

  const hongluanBranch = getHongluanBranch(yearBranch)
  const tianxiBranch = getOppositeBranch(hongluanBranch)
  const xianchiBranch = getXianchiBranch(yearBranch)
  const tianyaoBranch = moveBranch("chou", context.lunarInfo.lunarMonth - 1)

  return [
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.hongluan,
      branch: hongluanBranch,
      placementRuleId: "misc.romance.hongluan.year-branch",
      debug: {
        yearBranch,
        startBranch: "mao",
        direction: "backward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.tianxi,
      branch: tianxiBranch,
      placementRuleId: "misc.romance.tianxi.opposite-hongluan",
      debug: {
        yearBranch,
        hongluanBranch
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.xianchi,
      branch: xianchiBranch,
      placementRuleId: "misc.romance.xianchi.year-branch-group",
      debug: {
        yearBranch
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.tianyao,
      branch: tianyaoBranch,
      placementRuleId: "misc.romance.tianyao.lunar-month",
      debug: {
        lunarMonth: context.lunarInfo.lunarMonth,
        startBranch: "chou",
        direction: "forward"
      }
    })
  ]
}

function getHongluanBranch(yearBranch: BranchPalace): BranchPalace {
  const offset = TIME_BRANCH_ORDER.indexOf(yearBranch)

  if (offset < 0) {
    throw new Error(`Unknown lunar year branch for Hongluan: ${yearBranch}`)
  }

  return moveBranch("mao", -offset)
}

function getXianchiBranch(yearBranch: BranchPalace): BranchPalace {
  const match = XIANCHI_BY_YEAR_BRANCH_GROUP.find((group) => {
    return group.branches.includes(yearBranch)
  })

  if (!match) {
    throw new Error(`Unknown lunar year branch for Xianchi: ${yearBranch}`)
  }

  return match.xianchi
}
