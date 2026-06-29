import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { ASSISTANT_STAR_IDS } from "../../star-catalog"

import { createAssistantPlacedStar } from "./assistant-placement-utils"

export function placeChangQuStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const wenchangBranch = resolveWenchangBranch(context.lunarInfo.timeBranchNumber)
  const wenquBranch = resolveWenquBranch(context.lunarInfo.timeBranchNumber)

  return [
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.wenchang,
      branch: wenchangBranch,
      placementRuleId: "assistant.chang-qu.time-branch",
      debug: {
        timeBranch: context.lunarInfo.timeBranch,
        timeBranchNumber: context.lunarInfo.timeBranchNumber,
        startBranch: "xu",
        direction: "backward"
      }
    }),
    createAssistantPlacedStar({
      context,
      starId: ASSISTANT_STAR_IDS.wenqu,
      branch: wenquBranch,
      placementRuleId: "assistant.chang-qu.time-branch",
      debug: {
        timeBranch: context.lunarInfo.timeBranch,
        timeBranchNumber: context.lunarInfo.timeBranchNumber,
        startBranch: "chen",
        direction: "forward"
      }
    })
  ]
}

export function resolveWenchangBranch(timeBranchNumber: number): BranchPalace {
  return moveBranch("xu", -(timeBranchNumber - 1))
}

export function resolveWenquBranch(timeBranchNumber: number): BranchPalace {
  return moveBranch("chen", timeBranchNumber - 1)
}
