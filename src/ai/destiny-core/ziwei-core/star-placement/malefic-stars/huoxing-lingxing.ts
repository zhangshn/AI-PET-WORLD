import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { MALEFIC_STAR_IDS } from "../../star-catalog"

import { createMaleficPlacedStar } from "./malefic-placement-utils"

const HUOLING_START_BY_YEAR_BRANCH_GROUP: Array<{
  branches: BranchPalace[]
  huoxingStart: BranchPalace
  lingxingStart: BranchPalace
}> = [
  {
    branches: ["shen", "zi", "chen"],
    huoxingStart: "yin",
    lingxingStart: "xu"
  },
  {
    branches: ["yin", "wu", "xu"],
    huoxingStart: "chou",
    lingxingStart: "mao"
  },
  {
    branches: ["si", "you", "chou"],
    huoxingStart: "mao",
    lingxingStart: "xu"
  },
  {
    branches: ["hai", "mao", "wei"],
    huoxingStart: "you",
    lingxingStart: "xu"
  }
]

export function placeHuoxingLingxingStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const yearBranch = context.lunarInfo.yearBranch

  if (!yearBranch) {
    throw new Error("Missing lunar year branch for Huoxing/Lingxing placement.")
  }

  const starts = getHuolingStarts(yearBranch)
  const timeOffset = context.lunarInfo.timeBranchNumber - 1

  return [
    createMaleficPlacedStar({
      context,
      starId: MALEFIC_STAR_IDS.huoxing,
      branch: moveBranch(starts.huoxingStart, timeOffset),
      placementRuleId: "malefic.huoxing-lingxing.year-branch-time",
      debug: {
        yearBranch,
        timeBranch: context.lunarInfo.timeBranch,
        timeBranchNumber: context.lunarInfo.timeBranchNumber,
        startBranch: starts.huoxingStart,
        direction: "forward"
      }
    }),
    createMaleficPlacedStar({
      context,
      starId: MALEFIC_STAR_IDS.lingxing,
      branch: moveBranch(starts.lingxingStart, timeOffset),
      placementRuleId: "malefic.huoxing-lingxing.year-branch-time",
      debug: {
        yearBranch,
        timeBranch: context.lunarInfo.timeBranch,
        timeBranchNumber: context.lunarInfo.timeBranchNumber,
        startBranch: starts.lingxingStart,
        direction: "forward"
      }
    })
  ]
}

function getHuolingStarts(yearBranch: BranchPalace): {
  huoxingStart: BranchPalace
  lingxingStart: BranchPalace
} {
  const match = HUOLING_START_BY_YEAR_BRANCH_GROUP.find((group) => {
    return group.branches.includes(yearBranch)
  })

  if (!match) {
    throw new Error(`Unknown lunar year branch for Huoxing/Lingxing: ${yearBranch}`)
  }

  return {
    huoxingStart: match.huoxingStart,
    lingxingStart: match.lingxingStart
  }
}
