import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeBoshiCycleStars } from "./boshi-cycle"
import { placeJiangqianCycleStars } from "./jiangqian-cycle"
import { placeSuiqianCycleStars } from "./suiqian-cycle"

export function placeAnnualStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeBoshiCycleStars(context),
    ...placeSuiqianCycleStars(context),
    ...placeJiangqianCycleStars(context)
  ]
}
