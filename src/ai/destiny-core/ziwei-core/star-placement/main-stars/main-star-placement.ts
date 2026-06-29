import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { calculateTianfuIndex } from "./tianfu-star"
import { placeTianfuSystemStars } from "./tianfu-system"
import { calculateZiweiIndex } from "./ziwei-star"
import { placeZiweiSystemStars } from "./ziwei-system"

export function placeMainStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  const ziweiIndex = calculateZiweiIndex(
    context.lunarInfo.lunarDay,
    context.foundation.elementBase
  )
  const tianfuIndex = calculateTianfuIndex(ziweiIndex)

  return [
    ...placeZiweiSystemStars({
      context,
      ziweiIndex
    }),
    ...placeTianfuSystemStars({
      context,
      tianfuIndex
    })
  ]
}
