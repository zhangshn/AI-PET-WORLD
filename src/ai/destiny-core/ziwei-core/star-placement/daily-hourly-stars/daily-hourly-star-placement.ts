import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeAssistantDerivedDailyHourlyStars } from "./assistant-derived-stars"

export function placeDailyHourlyStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeAssistantDerivedDailyHourlyStars(context)
  ]
}
