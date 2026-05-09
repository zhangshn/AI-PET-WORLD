/**
 * 当前文件负责：把紫微排盘引擎结果适配成业务层 BirthPattern。
 */

import type {
  BirthInput,
  BirthPattern,
  BranchPalace,
  BranchPalaceStars,
  BorrowedPalace,
  BorrowedPalaceInfo,
  SectorName,
  SectorStars,
  StarId
} from "./schema"

import { convertSolarToLunarInfo } from "./lunar"
import { calculateZiweiEngine, getOppositePalace } from "./ziwei-engine"

const PALACE_ROLE_TO_SECTOR: SectorName[] = [
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

function createEmptySectors(): SectorStars {
  const sectors = {} as SectorStars

  PALACE_ROLE_TO_SECTOR.forEach((name) => {
    sectors[name] = []
  })

  return sectors
}

function buildDynamicPalaceMaps(
  palaceSequence: BranchPalace[]
): {
  branchToSectorMap: Record<BranchPalace, SectorName>
  sectorToBranchMap: Record<SectorName, BranchPalace>
} {
  const branchToSectorMap = {} as Record<BranchPalace, SectorName>
  const sectorToBranchMap = {} as Record<SectorName, BranchPalace>

  PALACE_ROLE_TO_SECTOR.forEach((sectorName, index) => {
    const branch = palaceSequence[index]
    branchToSectorMap[branch] = sectorName
    sectorToBranchMap[sectorName] = branch
  })

  return {
    branchToSectorMap,
    sectorToBranchMap
  }
}

function mapBranchPalacesToSectors(
  branchPalaces: BranchPalaceStars,
  sectorToBranchMap: Record<SectorName, BranchPalace>
): SectorStars {
  const sectors = createEmptySectors()

  PALACE_ROLE_TO_SECTOR.forEach((sectorName) => {
    const branch = sectorToBranchMap[sectorName]
    sectors[sectorName] = [...branchPalaces[branch]]
  })

  return sectors
}

function getSupportSectors(primarySector: SectorName): SectorName[] {
  const index = PALACE_ROLE_TO_SECTOR.indexOf(primarySector)

  if (index === -1) {
    throw new Error(`未知业务宫位: ${primarySector}`)
  }

  const mod12 = (n: number) => ((n % 12) + 12) % 12

  return [
    PALACE_ROLE_TO_SECTOR[mod12(index + 4)],
    PALACE_ROLE_TO_SECTOR[mod12(index + 8)],
    PALACE_ROLE_TO_SECTOR[mod12(index + 6)]
  ]
}

function mapSupportSectorsToBranches(
  supportSectors: SectorName[],
  sectorToBranchMap: Record<SectorName, BranchPalace>
): BranchPalace[] {
  return supportSectors.map((sector) => sectorToBranchMap[sector])
}

function collectSupportStars(
  branchPalaces: BranchPalaceStars,
  supportBranchPalaces: BranchPalace[]
): StarId[] {
  const set = new Set<StarId>()

  supportBranchPalaces.forEach((palace) => {
    branchPalaces[palace].forEach((starId) => {
      set.add(starId)
    })
  })

  return Array.from(set)
}

function countEmptySectors(sectors: SectorStars): number {
  let count = 0

  Object.values(sectors).forEach((stars) => {
    if (stars.length === 0) {
      count++
    }
  })

  return count
}

function mapBorrowedPalaces(
  engineBorrowedPalaces: BorrowedPalaceInfo[]
): BorrowedPalace[] {
  return engineBorrowedPalaces.map((item) => ({
    targetPalace: item.palace,
    sourcePalace: item.sourcePalace,
    stars: [...item.borrowedStars]
  }))
}

export function calculateBirthPattern(
  input: BirthInput
): BirthPattern {
  const lunarInfo = convertSolarToLunarInfo(input)

  const engineResult = calculateZiweiEngine(lunarInfo)

  const primaryBranchPalace = engineResult.lifePalace
  const bodyBranchPalace = engineResult.bodyPalace
  const elementGate = engineResult.elementGate
  const elementBase = engineResult.elementBase
  const branchPalaces = engineResult.nativeStars
  const borrowedPalaces = mapBorrowedPalaces(engineResult.borrowedPalaces)

  const { branchToSectorMap, sectorToBranchMap } = buildDynamicPalaceMaps(
    engineResult.palaceSequence
  )

  const sectors = mapBranchPalacesToSectors(
    branchPalaces,
    sectorToBranchMap
  )

  const primarySector = branchToSectorMap[primaryBranchPalace]
  const primaryStars = [...branchPalaces[primaryBranchPalace]]
  const isEmptyPrimary = primaryStars.length === 0

  const oppositeBranchPalace = getOppositePalace(primaryBranchPalace)
  const oppositeSector = branchToSectorMap[oppositeBranchPalace]
  const borrowedStars = [...branchPalaces[oppositeBranchPalace]]

  const supportSectors = getSupportSectors(primarySector)
  const supportBranchPalaces = mapSupportSectorsToBranches(
    supportSectors,
    sectorToBranchMap
  )
  const supportStars = collectSupportStars(
    branchPalaces,
    supportBranchPalaces
  )

  const emptySectorCount = countEmptySectors(sectors)

  const birthKey =
    `${input.year}-${input.month}-${input.day}-` +
    `${input.hour}-${input.minute ?? 0}`

  return {
    birthKey,

    lunarInfo,
    timeBranch: lunarInfo.timeBranch,

    engine: "star-pair-engine",

    primaryBranchPalace,
    bodyBranchPalace,

    elementGate,
    elementBase,

    branchPalaces,

    branchToSectorMap,
    sectorToBranchMap,

    borrowedPalaces,

    sectors,

    primarySector,

    supportSectors,
    supportBranchPalaces,
    supportStars,
    supportSymbols: [...supportStars],

    primaryStars,

    isEmptyPrimary,

    oppositeSector,
    oppositeBranchPalace,
    borrowedStars,

    emptySectorCount
  }
}