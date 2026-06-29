import type {
  BranchPalace,
  BranchToSectorMap,
  SectorName,
  SectorToBranchMap
} from "../contracts"

import { getBranchByIndex, getBranchIndex, SECTOR_ORDER } from "../shared"

export function calculatePalaceSequence(
  lifePalace: BranchPalace
): BranchPalace[] {
  const lifeIndex = getBranchIndex(lifePalace)

  return Array.from({ length: 12 }, (_, index) => {
    return getBranchByIndex(lifeIndex - index)
  })
}

export function buildPalaceSectorMaps(
  palaceSequence: BranchPalace[]
): {
  branchToSectorMap: BranchToSectorMap
  sectorToBranchMap: SectorToBranchMap
} {
  const branchToSectorMap = {} as BranchToSectorMap
  const sectorToBranchMap = {} as SectorToBranchMap

  SECTOR_ORDER.forEach((sectorName: SectorName, index) => {
    const branch = palaceSequence[index]
    branchToSectorMap[branch] = sectorName
    sectorToBranchMap[sectorName] = branch
  })

  return {
    branchToSectorMap,
    sectorToBranchMap
  }
}
