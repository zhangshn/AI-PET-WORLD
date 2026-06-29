import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { TIME_BRANCH_ORDER, moveBranch } from "../../shared"
import { MISC_STAR_IDS } from "../../star-catalog"

import { createMiscPlacedStar } from "./misc-placement-utils"

const POSUI_BY_YEAR_BRANCH_GROUP: Array<{
  branches: BranchPalace[]
  posui: BranchPalace
}> = [
  { branches: ["zi", "wu", "mao", "you"], posui: "si" },
  { branches: ["yin", "shen", "si", "hai"], posui: "you" },
  { branches: ["chen", "xu", "chou", "wei"], posui: "chou" }
]

export function placePunishmentStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const yearBranch = context.lunarInfo.yearBranch

  if (!yearBranch) {
    throw new Error("Missing lunar year branch for punishment star placement.")
  }

  const yearOffset = getYearBranchOffset(yearBranch)

  return [
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.tianxing,
      branch: moveBranch("you", context.lunarInfo.lunarMonth - 1),
      placementRuleId: "misc.punishment.tianxing.lunar-month",
      debug: {
        lunarMonth: context.lunarInfo.lunarMonth,
        startBranch: "you",
        direction: "forward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.posui,
      branch: getPosuiBranch(yearBranch),
      placementRuleId: "misc.punishment.posui.year-branch-group",
      debug: {
        yearBranch
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.tianku,
      branch: moveBranch("wu", -yearOffset),
      placementRuleId: "misc.punishment.tianku-tianxu.year-branch",
      debug: {
        yearBranch,
        startBranch: "wu",
        direction: "backward"
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.tianxu,
      branch: moveBranch("wu", yearOffset),
      placementRuleId: "misc.punishment.tianku-tianxu.year-branch",
      debug: {
        yearBranch,
        startBranch: "wu",
        direction: "forward"
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

function getPosuiBranch(yearBranch: BranchPalace): BranchPalace {
  const match = POSUI_BY_YEAR_BRANCH_GROUP.find((group) => {
    return group.branches.includes(yearBranch)
  })

  if (!match) {
    throw new Error(`Unknown lunar year branch for Posui: ${yearBranch}`)
  }

  return match.posui
}
