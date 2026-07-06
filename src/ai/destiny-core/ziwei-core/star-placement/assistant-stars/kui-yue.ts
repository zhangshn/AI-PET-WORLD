import type {
  BranchPalace,
  HeavenlyStem,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { ASSISTANT_STAR_IDS } from "../../star-catalog"

import { createAssistantPlacedStar } from "./assistant-placement-utils"

const KUI_YUE_BY_YEAR_STEM: Record<
  HeavenlyStem,
  {
    tiankui: BranchPalace
    tianyue: BranchPalace
  }
> = {
  jia: { tiankui: "chou", tianyue: "wei" },
  yi: { tiankui: "zi", tianyue: "shen" },
  bing: { tiankui: "hai", tianyue: "you" },
  ding: { tiankui: "hai", tianyue: "you" },
  wu: { tiankui: "chou", tianyue: "wei" },
  ji: { tiankui: "zi", tianyue: "shen" },
  geng: { tiankui: "chou", tianyue: "wei" },
  xin: { tiankui: "wu", tianyue: "yin" },
  ren: { tiankui: "mao", tianyue: "si" },
  gui: { tiankui: "mao", tianyue: "si" }
}

export function placeKuiYueStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const branches = getKuiYueBranches(context.lunarInfo.yearStem)

  return [
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.tiankui,
      branch: branches.tiankui,
      placementRuleId: "assistant.kui-yue.year-stem",
      debug: {
        yearStem: context.lunarInfo.yearStem
      }
    }),
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.tianyue,
      branch: branches.tianyue,
      placementRuleId: "assistant.kui-yue.year-stem",
      debug: {
        yearStem: context.lunarInfo.yearStem
      }
    })
  ]
}

export function getKuiYueBranches(yearStem: HeavenlyStem): {
  tiankui: BranchPalace
  tianyue: BranchPalace
} {
  return KUI_YUE_BY_YEAR_STEM[yearStem]
}
