import type { BranchPalace, HeavenlyStem } from "../contracts"

import {
  getStemByIndex,
  getStemIndex,
  PHYSICAL_BRANCH_ORDER
} from "../shared"

export function getYinStartStemByYearStem(
  yearStem: HeavenlyStem
): HeavenlyStem {
  switch (yearStem) {
    case "jia":
    case "ji":
      return "bing"
    case "yi":
    case "geng":
      return "wu"
    case "bing":
    case "xin":
      return "geng"
    case "ding":
    case "ren":
      return "ren"
    case "wu":
    case "gui":
      return "jia"
    default:
      throw new Error(`Unknown year stem: ${yearStem}`)
  }
}

export function buildPalaceStemMap(
  yearStem: HeavenlyStem
): Record<BranchPalace, HeavenlyStem> {
  const yinStartStem = getYinStartStemByYearStem(yearStem)
  const startStemIndex = getStemIndex(yinStartStem)
  const result = {} as Record<BranchPalace, HeavenlyStem>

  PHYSICAL_BRANCH_ORDER.forEach((branch, index) => {
    result[branch] = getStemByIndex(startStemIndex + index)
  })

  return result
}
