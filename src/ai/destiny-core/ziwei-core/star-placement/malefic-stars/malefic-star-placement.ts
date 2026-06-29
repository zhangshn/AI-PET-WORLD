import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeDikongDijieStars } from "./dikong-dijie"
import { placeHuoxingLingxingStars } from "./huoxing-lingxing"
import { placeQingyangTuoluoStars } from "./qingyang-tuoluo"

export function placeMaleficStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeQingyangTuoluoStars(context),
    ...placeHuoxingLingxingStars(context),
    ...placeDikongDijieStars(context)
  ]
}
