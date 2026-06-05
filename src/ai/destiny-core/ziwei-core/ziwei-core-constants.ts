/**
 * AI-PET-WORLD
 * Personality Core - Ziwei constants.
 */

import type { SectorName } from "./ziwei-core-schema"

/**
 * Business sector order used by the personality adapter.
 * This is not the traditional Ziwei palace coordinate order.
 */
export const SECTOR_ORDER: SectorName[] = [
  "life",
  "siblings",
  "spouse",
  "children",
  "wealth",
  "health",
  "travel",
  "friends",
  "career",
  "property",
  "fortune",
  "parents"
]

export const DEFAULT_TRAIT_VALUE = 50

export const MIN_TRAIT_VALUE = 0

export const MAX_TRAIT_VALUE = 100

export const PRIMARY_STAR_WEIGHT = 1.0

export const SUPPORT_STAR_WEIGHT = 0.4

export const BORROWED_STAR_WEIGHT = 0.65

export const EMPTY_PRIMARY_ATTENUATION = 0.85
