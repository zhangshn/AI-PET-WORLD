import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeMonthBasedStars } from "./month-based-stars"

export function placeMonthlyStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeMonthBasedStars(context)
  ]
}
