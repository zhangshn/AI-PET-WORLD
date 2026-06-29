import type {
  ZiweiPlacementContext,
  ZiweiPlacementResult
} from "../contracts"

import { placeAnnualStars } from "./annual-stars"
import { placeAssistantStars } from "./assistant-stars"
import { placeDailyHourlyStars } from "./daily-hourly-stars"
import { placeLifecycleStars } from "./lifecycle-stars"
import { placeMainStars } from "./main-stars"
import { placeMaleficStars } from "./malefic-stars"
import { placeMiscStars } from "./misc-stars"
import { placeMonthlyStars } from "./monthly-stars"
import { placeNatalTransformations } from "./transformations"

export function placeZiweiStars(
  context: ZiweiPlacementContext
): ZiweiPlacementResult {
  const baseStars = [
    ...placeMainStars(context),
    ...placeAssistantStars(context),
    ...placeMaleficStars(context),
    ...placeMiscStars(context),
    ...placeLifecycleStars(context),
    ...placeAnnualStars(context),
    ...placeMonthlyStars(context),
    ...placeDailyHourlyStars(context)
  ]

  return {
    stars: [
      ...baseStars,
      ...placeNatalTransformations({
        context,
        placedStars: baseStars
      })
    ],
    warnings: []
  }
}
