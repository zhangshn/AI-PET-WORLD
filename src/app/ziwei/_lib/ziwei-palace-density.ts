import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import {
  CORE_DETAIL_CATEGORIES,
  FLOW_DETAIL_CATEGORIES,
  countSourceRules,
  countStars,
  filterStarGroups
} from "./ziwei-star-group-filters"

export interface ZiweiPalaceDensityRow {
  branch: ZiweiPalaceDetailView["branch"]
  branchLabel: string
  sectorLabel: string
  palaceStemLabel: string
  isLifePalace: boolean
  isBodyPalace: boolean
  starCount: number
  groupCount: number
  sourceRuleCount: number
  coreStarCount: number
  flowStarCount: number
}

export interface ZiweiPalaceDensitySummary {
  rows: ZiweiPalaceDensityRow[]
  totalStarCount: number
  maxStarCount: number
  minStarCount: number
  averageStarCount: number
}

export function buildPalaceDensitySummary(
  palaces: ZiweiPalaceDetailView[]
): ZiweiPalaceDensitySummary {
  const rows = palaces.map(buildPalaceDensityRow)
  const starCounts = rows.map((row) => row.starCount)
  const totalStarCount = starCounts.reduce((sum, count) => sum + count, 0)

  return {
    rows,
    totalStarCount,
    maxStarCount: Math.max(...starCounts),
    minStarCount: Math.min(...starCounts),
    averageStarCount: totalStarCount / Math.max(rows.length, 1)
  }
}

function buildPalaceDensityRow(
  palace: ZiweiPalaceDetailView
): ZiweiPalaceDensityRow {
  const coreGroups = filterStarGroups(palace.starGroups, CORE_DETAIL_CATEGORIES)
  const flowGroups = filterStarGroups(palace.starGroups, FLOW_DETAIL_CATEGORIES)

  return {
    branch: palace.branch,
    branchLabel: palace.branchLabel,
    sectorLabel: palace.sectorLabel,
    palaceStemLabel: palace.palaceStemLabel,
    isLifePalace: palace.isLifePalace,
    isBodyPalace: palace.isBodyPalace,
    starCount: countStars(palace.starGroups),
    groupCount: palace.starGroups.length,
    sourceRuleCount: countSourceRules(palace.starGroups),
    coreStarCount: countStars(coreGroups),
    flowStarCount: countStars(flowGroups)
  }
}
