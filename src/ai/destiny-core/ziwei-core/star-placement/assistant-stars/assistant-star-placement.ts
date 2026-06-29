import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeChangQuStars } from "./chang-qu"
import { placeKuiYueStars } from "./kui-yue"
import { placeLeftRightStars } from "./left-right"
import { placeLucunTianmaStars } from "./lucun-tianma"

export function placeAssistantStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeLeftRightStars(context),
    ...placeChangQuStars(context),
    ...placeKuiYueStars(context),
    ...placeLucunTianmaStars(context)
  ]
}
