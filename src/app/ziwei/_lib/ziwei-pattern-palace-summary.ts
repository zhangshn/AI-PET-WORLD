import type {
  BranchPalace,
  ZiweiPalaceDetailView
} from "@/ai/destiny-core/ziwei-core/contracts"

import type { ZiweiPatternMatchView } from "./ziwei-pattern-catalog"
import { sortZiweiPatternMatchesByPriority } from "./ziwei-pattern-priority"

export interface ZiweiPatternPalaceEntry {
  patternId: string
  label: string
  categoryLabel: string
  statusLabel: string
  strengthLabel: string
}

export interface ZiweiPatternPalaceSummaryRow {
  branch: BranchPalace
  branchLabel: string
  sectorLabel: string
  palaceStemLabel: string
  isLifePalace: boolean
  isBodyPalace: boolean
  hitCount: number
  enhancedCount: number
  brokenCount: number
  adverseHitCount: number
  gapCount: number
  entries: ZiweiPatternPalaceEntry[]
}

export interface ZiweiPatternPalaceSummaryView {
  rows: ZiweiPatternPalaceSummaryRow[]
  coveredPalaceCount: number
  totalHitCount: number
  totalGapCount: number
  totalBrokenCount: number
  totalAdverseHitCount: number
  unplacedGapCount: number
}

export function buildZiweiPatternPalaceSummary(params: {
  palaces: ZiweiPalaceDetailView[]
  matches: ZiweiPatternMatchView[]
}): ZiweiPatternPalaceSummaryView {
  const rowMaps = new Map<BranchPalace, ZiweiPatternMatchView[]>()
  const unplacedGapCount = params.matches.filter((match) => {
    return match.status !== "hit" && match.matchedPalaces.length === 0
  }).length

  params.matches.forEach((match) => {
    match.matchedPalaces.forEach((palace) => {
      rowMaps.set(palace.branch, [...(rowMaps.get(palace.branch) ?? []), match])
    })
  })

  const rows = params.palaces.map((palace) => {
    return buildPalaceSummaryRow(palace, rowMaps.get(palace.branch) ?? [])
  })

  return {
    rows,
    coveredPalaceCount: rows.filter((row) => row.entries.length > 0).length,
    totalHitCount: params.matches.filter((match) => match.status === "hit").length,
    totalGapCount: params.matches.filter((match) => match.status !== "hit").length,
    totalBrokenCount: params.matches.filter((match) => match.strength === "broken")
      .length,
    totalAdverseHitCount: params.matches.filter((match) => {
      return match.category === "adverse" && match.status === "hit"
    }).length,
    unplacedGapCount
  }
}

function buildPalaceSummaryRow(
  palace: ZiweiPalaceDetailView,
  matches: ZiweiPatternMatchView[]
): ZiweiPatternPalaceSummaryRow {
  const sortedMatches = sortZiweiPatternMatchesByPriority(matches)

  return {
    branch: palace.branch,
    branchLabel: palace.branchLabel,
    sectorLabel: palace.sectorLabel,
    palaceStemLabel: palace.palaceStemLabel,
    isLifePalace: palace.isLifePalace,
    isBodyPalace: palace.isBodyPalace,
    hitCount: sortedMatches.filter((match) => match.status === "hit").length,
    enhancedCount: sortedMatches.filter((match) => match.strength === "enhanced")
      .length,
    brokenCount: sortedMatches.filter((match) => match.strength === "broken")
      .length,
    adverseHitCount: sortedMatches.filter((match) => {
      return match.category === "adverse" && match.status === "hit"
    }).length,
    gapCount: sortedMatches.filter((match) => match.status !== "hit").length,
    entries: sortedMatches.map(buildPalaceEntry)
  }
}

function buildPalaceEntry(
  match: ZiweiPatternMatchView
): ZiweiPatternPalaceEntry {
  return {
    patternId: match.id,
    label: match.label,
    categoryLabel: match.categoryLabel,
    statusLabel: match.status === "hit" ? "已命中" : "未成格",
    strengthLabel: match.strengthLabel
  }
}
