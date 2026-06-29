import type { SectorName } from "../contracts"

export const SECTOR_ORDER = [
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
] as const satisfies readonly SectorName[]
