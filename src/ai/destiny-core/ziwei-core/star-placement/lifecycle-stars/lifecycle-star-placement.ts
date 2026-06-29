import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeChangshengCycleStars } from "./changsheng-cycle"

export function placeLifecycleStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeChangshengCycleStars(context)
  ]
}
