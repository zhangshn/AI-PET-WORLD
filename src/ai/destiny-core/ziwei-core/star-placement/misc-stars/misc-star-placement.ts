import type {
  ZiweiPlacedStar,
  ZiweiPlacementContext
} from "../../contracts"

import { placeNoblemanStars } from "./nobleman-stars"
import { placePunishmentStars } from "./punishment-stars"
import { placeRomanceStars } from "./romance-stars"
import { placeSolitaryStars } from "./solitary-stars"

export function placeMiscStars(
  context: ZiweiPlacementContext
): ZiweiPlacedStar[] {
  return [
    ...placeRomanceStars(context),
    ...placeNoblemanStars(context),
    ...placeSolitaryStars(context),
    ...placePunishmentStars(context)
  ]
}
