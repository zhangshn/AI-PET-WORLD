import type {
  BirthInput,
  BirthPattern,
  BorrowedPalace,
  BranchPalace,
  BranchPalaceStars,
  SectorName,
  SectorStars,
  StarId
} from "../ziwei-core-schema"
import type { ZiweiPlacementContext } from "../contracts"

import { convertZiweiBirthInputToLunarInfo } from "../birth"
import { buildZiweiNatalFoundation } from "../natal-foundation"
import { PHYSICAL_BRANCH_ORDER, SECTOR_ORDER, getOppositeBranch } from "../shared"
import { getZiweiStarDefinition } from "../star-catalog"
import { placeMainStars } from "../star-placement/main-stars"

export function buildLegacyBirthPattern(input: BirthInput): BirthPattern {
  const lunarInfo = convertZiweiBirthInputToLunarInfo(input)
  const foundation = buildZiweiNatalFoundation(lunarInfo)
  const context: ZiweiPlacementContext = {
    ruleSetVersion: "legacy-birth-pattern-v1",
    input: {
      calendarType: "solar",
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute ?? 0,
      timezone: "Asia/Shanghai",
      ruleSetVersion: "legacy-birth-pattern-v1"
    },
    lunarInfo,
    foundation
  }
  const branchPalaces = mapPlacedMainStarsToLegacyBranchPalaces(
    placeMainStars(context)
  )
  const sectors = mapBranchPalacesToSectors(
    branchPalaces,
    foundation.sectorToBranchMap
  )
  const primaryBranchPalace = foundation.lifePalace
  const bodyBranchPalace = foundation.bodyPalace
  const primarySector = foundation.branchToSectorMap[primaryBranchPalace]
  const primaryStars = [...branchPalaces[primaryBranchPalace]]
  const oppositeBranchPalace = getOppositeBranch(primaryBranchPalace)
  const oppositeSector = foundation.branchToSectorMap[oppositeBranchPalace]
  const borrowedStars = [...branchPalaces[oppositeBranchPalace]]
  const supportSectors = getSupportSectors(primarySector)
  const supportBranchPalaces = supportSectors.map((sector) => {
    return foundation.sectorToBranchMap[sector]
  })
  const supportStars = collectSupportStars(
    branchPalaces,
    supportBranchPalaces
  )

  return {
    birthKey: `${input.year}-${input.month}-${input.day}-${input.hour ?? "unknown"}`,
    lunarInfo,
    timeBranch: lunarInfo.timeBranch,
    engine: "star-pair-engine",
    primaryBranchPalace,
    bodyBranchPalace,
    elementGate: foundation.elementGate,
    elementBase: foundation.elementBase,
    branchPalaces,
    branchToSectorMap: foundation.branchToSectorMap,
    sectorToBranchMap: foundation.sectorToBranchMap,
    borrowedPalaces: buildLegacyBorrowedPalaces(branchPalaces),
    sectors,
    primarySector,
    supportSectors,
    supportBranchPalaces,
    supportStars,
    supportSymbols: [...supportStars],
    primaryStars,
    isEmptyPrimary: primaryStars.length === 0,
    oppositeSector,
    oppositeBranchPalace,
    borrowedStars,
    emptySectorCount: countEmptySectors(sectors)
  }
}

function createEmptyLegacyBranchPalaces(): BranchPalaceStars {
  const palaces = {} as BranchPalaceStars

  PHYSICAL_BRANCH_ORDER.forEach((branch) => {
    palaces[branch] = []
  })

  return palaces
}

function createEmptyLegacySectors(): SectorStars {
  const sectors = {} as SectorStars

  SECTOR_ORDER.forEach((sector) => {
    sectors[sector] = []
  })

  return sectors
}

function mapPlacedMainStarsToLegacyBranchPalaces(
  placedStars: Array<{ branch: BranchPalace; starId: string }>
): BranchPalaceStars {
  const palaces = createEmptyLegacyBranchPalaces()

  placedStars.forEach((star) => {
    const definition = getZiweiStarDefinition(star.starId)
    const legacyStarId = definition?.legacyStarId

    if (!legacyStarId) {
      throw new Error(`Missing legacy star mapping: ${star.starId}`)
    }

    palaces[star.branch].push(legacyStarId)
  })

  return palaces
}

function mapBranchPalacesToSectors(
  branchPalaces: BranchPalaceStars,
  sectorToBranchMap: Record<SectorName, BranchPalace>
): SectorStars {
  const sectors = createEmptyLegacySectors()

  SECTOR_ORDER.forEach((sectorName) => {
    const branch = sectorToBranchMap[sectorName]
    sectors[sectorName] = [...branchPalaces[branch]]
  })

  return sectors
}

function getSupportSectors(primarySector: SectorName): SectorName[] {
  const index = SECTOR_ORDER.indexOf(primarySector)

  if (index < 0) {
    throw new Error(`Unknown sector: ${primarySector}`)
  }

  return [
    SECTOR_ORDER[(index + 4) % 12],
    SECTOR_ORDER[(index + 8) % 12],
    SECTOR_ORDER[(index + 6) % 12]
  ]
}

function collectSupportStars(
  branchPalaces: BranchPalaceStars,
  supportBranchPalaces: BranchPalace[]
): StarId[] {
  const set = new Set<StarId>()

  supportBranchPalaces.forEach((palace) => {
    branchPalaces[palace].forEach((starId) => set.add(starId))
  })

  return Array.from(set)
}

function buildLegacyBorrowedPalaces(
  branchPalaces: BranchPalaceStars
): BorrowedPalace[] {
  const borrowedPalaces: BorrowedPalace[] = []

  PHYSICAL_BRANCH_ORDER.forEach((palace) => {
    if (branchPalaces[palace].length > 0) {
      return
    }

    const sourcePalace = getOppositeBranch(palace)

    borrowedPalaces.push({
      targetPalace: palace,
      sourcePalace,
      stars: [...branchPalaces[sourcePalace]]
    })
  })

  return borrowedPalaces
}

function countEmptySectors(sectors: SectorStars): number {
  return Object.values(sectors).reduce((count, stars) => {
    return stars.length === 0 ? count + 1 : count
  }, 0)
}
