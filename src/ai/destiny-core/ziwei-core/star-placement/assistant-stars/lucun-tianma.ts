import type {
  BranchPalace,
  HeavenlyStem,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { ASSISTANT_STAR_IDS } from "../../star-catalog"

import { createAssistantPlacedStar } from "./assistant-placement-utils"

export const LUCUN_BY_YEAR_STEM: Record<HeavenlyStem, BranchPalace> = {
  jia: "yin",
  yi: "mao",
  bing: "si",
  ding: "wu",
  wu: "si",
  ji: "wu",
  geng: "shen",
  xin: "you",
  ren: "hai",
  gui: "zi"
}

const TIANMA_BY_YEAR_BRANCH_GROUP: Array<{
  branches: BranchPalace[]
  tianma: BranchPalace
}> = [
  { branches: ["yin", "wu", "xu"], tianma: "shen" },
  { branches: ["shen", "zi", "chen"], tianma: "yin" },
  { branches: ["si", "you", "chou"], tianma: "hai" },
  { branches: ["hai", "mao", "wei"], tianma: "si" }
]

export function placeLucunTianmaStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const lucunBranch = getLucunBranch(context.lunarInfo.yearStem)
  const tianmaBranch = getTianmaBranch(context.lunarInfo.yearBranch)

  return [
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.lucun,
      branch: lucunBranch,
      placementRuleId: "assistant.lucun.year-stem",
      debug: {
        yearStem: context.lunarInfo.yearStem
      }
    }),
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.tianma,
      branch: tianmaBranch,
      placementRuleId: "assistant.tianma.year-branch",
      debug: {
        yearBranch: context.lunarInfo.yearBranch
      }
    })
  ]
}

export function getLucunBranch(yearStem: HeavenlyStem): BranchPalace {
  return LUCUN_BY_YEAR_STEM[yearStem]
}

function getTianmaBranch(yearBranch: BranchPalace | undefined): BranchPalace {
  if (!yearBranch) {
    throw new Error("Missing lunar year branch for Tianma placement.")
  }

  const match = TIANMA_BY_YEAR_BRANCH_GROUP.find((group) => {
    return group.branches.includes(yearBranch)
  })

  if (!match) {
    throw new Error(`Unknown lunar year branch for Tianma: ${yearBranch}`)
  }

  return match.tianma
}
