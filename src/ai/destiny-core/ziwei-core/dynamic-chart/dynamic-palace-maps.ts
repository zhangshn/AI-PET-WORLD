import type { BranchPalace, SectorName } from "../contracts"
import { moveBranch, SECTOR_ORDER } from "../shared"

export function buildDynamicPalaceMaps(
  dynamicLifePalace: BranchPalace
): {
  dynamicBranchToSectorMap: Record<BranchPalace, SectorName>
  dynamicSectorToBranchMap: Record<SectorName, BranchPalace>
} {
  const dynamicBranchToSectorMap = {} as Record<BranchPalace, SectorName>
  const dynamicSectorToBranchMap = {} as Record<SectorName, BranchPalace>

  SECTOR_ORDER.forEach((sectorName, index) => {
    const branch = moveBranch(dynamicLifePalace, -index)
    dynamicBranchToSectorMap[branch] = sectorName
    dynamicSectorToBranchMap[sectorName] = branch
  })

  return {
    dynamicBranchToSectorMap,
    dynamicSectorToBranchMap
  }
}
