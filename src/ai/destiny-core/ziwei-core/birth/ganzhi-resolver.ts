import type { BranchPalace, HeavenlyStem } from "../contracts"

import { getStemByIndex } from "../shared"

export function getYearStem(year: number): HeavenlyStem {
  return getStemByIndex(year - 4)
}

const YEAR_BRANCH_ORDER: BranchPalace[] = [
  "zi",
  "chou",
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai"
]

export function getYearBranch(year: number): BranchPalace {
  const index = ((year - 4) % 12 + 12) % 12
  return YEAR_BRANCH_ORDER[index]
}
