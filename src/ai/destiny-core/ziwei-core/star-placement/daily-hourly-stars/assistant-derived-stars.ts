import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"
import { moveBranch } from "../../shared"
import { DAILY_HOURLY_STAR_IDS } from "../../star-catalog"
import {
  resolveWenchangBranch,
  resolveWenquBranch
} from "../assistant-stars/chang-qu"
import {
  resolveYoubiBranch,
  resolveZuofuBranch
} from "../assistant-stars/left-right"

import { createDailyHourlyPlacedStar } from "./daily-hourly-placement-utils"

export function placeAssistantDerivedDailyHourlyStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const lunarDay = context.lunarInfo.lunarDay
  const zuofuBranch = resolveZuofuBranch(context.lunarInfo.lunarMonth)
  const youbiBranch = resolveYoubiBranch(context.lunarInfo.lunarMonth)
  const wenchangBranch = resolveWenchangBranch(context.lunarInfo.timeBranchNumber)
  const wenquBranch = resolveWenquBranch(context.lunarInfo.timeBranchNumber)

  return [
    createDailyHourlyPlacedStar({
      context,
      starId: DAILY_HOURLY_STAR_IDS.santai,
      branch: moveBranch(zuofuBranch, lunarDay - 1),
      placementRuleId: "daily-hourly.santai.zuofu-lunar-day-forward",
      debug: {
        lunarDay,
        zuofuBranch,
        direction: "forward"
      }
    }),
    createDailyHourlyPlacedStar({
      context,
      starId: DAILY_HOURLY_STAR_IDS.bazuo,
      branch: moveBranch(youbiBranch, -(lunarDay - 1)),
      placementRuleId: "daily-hourly.bazuo.youbi-lunar-day-backward",
      debug: {
        lunarDay,
        youbiBranch,
        direction: "backward"
      }
    }),
    createDailyHourlyPlacedStar({
      context,
      starId: DAILY_HOURLY_STAR_IDS.enguang,
      branch: moveBranch(wenchangBranch, lunarDay - 2),
      placementRuleId: "daily-hourly.enguang.wenchang-lunar-day-minus-one",
      debug: {
        lunarDay,
        wenchangBranch,
        direction: "forward",
        finalOffsetAdjustment: -1
      }
    }),
    createDailyHourlyPlacedStar({
      context,
      starId: DAILY_HOURLY_STAR_IDS.tiangui,
      branch: moveBranch(wenquBranch, lunarDay - 2),
      placementRuleId: "daily-hourly.tiangui.wenqu-lunar-day-minus-one",
      debug: {
        lunarDay,
        wenquBranch,
        direction: "forward",
        finalOffsetAdjustment: -1
      }
    })
  ]
}
