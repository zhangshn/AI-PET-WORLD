import type { ZiweiStarDefinition, ZiweiStarId } from "../contracts"

import { assistantStarCatalog } from "./assistant-star-catalog"
import { dailyHourlyStarCatalog } from "./daily-hourly-star-catalog"
import { lifecycleStarCatalog } from "./lifecycle-star-catalog"
import { mainStarCatalog } from "./main-star-catalog"
import { maleficStarCatalog } from "./malefic-star-catalog"
import { miscStarCatalog } from "./misc-star-catalog"
import { monthlyStarCatalog } from "./monthly-star-catalog"
import { transformationStarCatalog } from "./transformation-star-catalog"
import { yearlyStarCatalog } from "./yearly-star-catalog"

export const ziweiStarCatalog: ZiweiStarDefinition[] = [
  ...mainStarCatalog,
  ...assistantStarCatalog,
  ...maleficStarCatalog,
  ...transformationStarCatalog,
  ...miscStarCatalog,
  ...lifecycleStarCatalog,
  ...yearlyStarCatalog,
  ...monthlyStarCatalog,
  ...dailyHourlyStarCatalog
]

export const ziweiStarCatalogById: Record<ZiweiStarId, ZiweiStarDefinition> =
  Object.fromEntries(
    ziweiStarCatalog.map((star) => [star.starId, star])
  ) as Record<ZiweiStarId, ZiweiStarDefinition>

export function getZiweiStarDefinition(
  starId: ZiweiStarId
): ZiweiStarDefinition | null {
  return ziweiStarCatalogById[starId] ?? null
}
