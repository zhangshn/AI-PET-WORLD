import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { MISC_STAR_IDS } from "../../star-catalog"

import { createMiscPlacedStar } from "./misc-placement-utils"

const SOLITARY_BY_YEAR_BRANCH_GROUP: Array<{
  branches: BranchPalace[]
  guchen: BranchPalace
  guasu: BranchPalace
}> = [
  { branches: ["yin", "mao", "chen"], guchen: "si", guasu: "chou" },
  { branches: ["si", "wu", "wei"], guchen: "shen", guasu: "chen" },
  { branches: ["shen", "you", "xu"], guchen: "hai", guasu: "wei" },
  { branches: ["hai", "zi", "chou"], guchen: "yin", guasu: "xu" }
]

export function placeSolitaryStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const yearBranch = context.lunarInfo.yearBranch

  if (!yearBranch) {
    throw new Error("Missing lunar year branch for solitary star placement.")
  }

  const branches = getSolitaryBranches(yearBranch)

  return [
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.guchen,
      branch: branches.guchen,
      placementRuleId: "misc.solitary.guchen-guasu.year-branch-group",
      debug: {
        yearBranch
      }
    }),
    createMiscPlacedStar({
      context,
      starId: MISC_STAR_IDS.guasu,
      branch: branches.guasu,
      placementRuleId: "misc.solitary.guchen-guasu.year-branch-group",
      debug: {
        yearBranch
      }
    })
  ]
}

function getSolitaryBranches(yearBranch: BranchPalace): {
  guchen: BranchPalace
  guasu: BranchPalace
} {
  const match = SOLITARY_BY_YEAR_BRANCH_GROUP.find((group) => {
    return group.branches.includes(yearBranch)
  })

  if (!match) {
    throw new Error(`Unknown lunar year branch for solitary stars: ${yearBranch}`)
  }

  return {
    guchen: match.guchen,
    guasu: match.guasu
  }
}
