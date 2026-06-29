import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { ASSISTANT_STAR_IDS } from "../../star-catalog"

import { createAssistantPlacedStar } from "./assistant-placement-utils"

export function placeLeftRightStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const zuofuBranch = resolveZuofuBranch(context.lunarInfo.lunarMonth)
  const youbiBranch = resolveYoubiBranch(context.lunarInfo.lunarMonth)

  return [
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.zuofu,
      branch: zuofuBranch,
      placementRuleId: "assistant.left-right.lunar-month",
      debug: {
        lunarMonth: context.lunarInfo.lunarMonth,
        startBranch: "chen",
        direction: "forward"
      }
    }),
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.youbi,
      branch: youbiBranch,
      placementRuleId: "assistant.left-right.lunar-month",
      debug: {
        lunarMonth: context.lunarInfo.lunarMonth,
        startBranch: "xu",
        direction: "backward"
      }
    })
  ]
}

export function resolveZuofuBranch(lunarMonth: number): BranchPalace {
  return moveBranch("chen", lunarMonth - 1)
}

export function resolveYoubiBranch(lunarMonth: number): BranchPalace {
  return moveBranch("xu", -(lunarMonth - 1))
}
