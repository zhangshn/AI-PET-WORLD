import type { BranchPalace } from "./branch-contract"

export type SectorName =
  | "life"
  | "siblings"
  | "spouse"
  | "children"
  | "wealth"
  | "health"
  | "travel"
  | "friends"
  | "career"
  | "property"
  | "fortune"
  | "parents"

export type BranchToSectorMap = Record<BranchPalace, SectorName>

export type SectorToBranchMap = Record<SectorName, BranchPalace>
