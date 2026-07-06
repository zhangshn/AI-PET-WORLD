import type {
  ZiweiPalaceDetailView,
  ZiweiStarBrightnessLevel
} from "@/ai/destiny-core/ziwei-core/contracts"

import {
  STAR_BRIGHTNESS_FILTER_LABELS,
  STAR_BRIGHTNESS_FILTER_ORDER
} from "./ziwei-star-brightness-summary"

export interface ZiweiPalaceBrightnessCount {
  level: ZiweiStarBrightnessLevel
  label: string
  count: number
}

export interface ZiweiPalaceBrightnessMatrixRow {
  branch: ZiweiPalaceDetailView["branch"]
  branchLabel: string
  sectorLabel: string
  palaceStemLabel: string
  isLifePalace: boolean
  isBodyPalace: boolean
  starCount: number
  mappedStarCount: number
  noFixedTableCount: number
  counts: ZiweiPalaceBrightnessCount[]
}

export interface ZiweiPalaceBrightnessMatrixSummary {
  rows: ZiweiPalaceBrightnessMatrixRow[]
  levelTotals: ZiweiPalaceBrightnessCount[]
  totalStarCount: number
  mappedStarCount: number
  noFixedTableCount: number
  maxPalaceStarCount: number
}

export function buildPalaceBrightnessMatrix(
  palaces: ZiweiPalaceDetailView[]
): ZiweiPalaceBrightnessMatrixSummary {
  const rows = palaces.map(buildPalaceBrightnessMatrixRow)
  const totalStarCount = rows.reduce((sum, row) => sum + row.starCount, 0)
  const mappedStarCount = rows.reduce((sum, row) => sum + row.mappedStarCount, 0)
  const noFixedTableCount = rows.reduce((sum, row) => {
    return sum + row.noFixedTableCount
  }, 0)
  const maxPalaceStarCount = rows.reduce((max, row) => {
    return Math.max(max, row.starCount)
  }, 0)

  return {
    rows,
    levelTotals: buildLevelTotals(rows),
    totalStarCount,
    mappedStarCount,
    noFixedTableCount,
    maxPalaceStarCount
  }
}

function buildPalaceBrightnessMatrixRow(
  palace: ZiweiPalaceDetailView
): ZiweiPalaceBrightnessMatrixRow {
  const stars = palace.starGroups.flatMap((group) => group.stars)
  const counts = STAR_BRIGHTNESS_FILTER_ORDER.map((level) => {
    return {
      level,
      label: STAR_BRIGHTNESS_FILTER_LABELS[level],
      count: stars.filter((star) => {
        return (star.brightness?.level ?? "unmapped") === level
      }).length
    }
  })
  const noFixedTableCount = counts.find((count) => {
    return count.level === "unmapped"
  })?.count ?? 0

  return {
    branch: palace.branch,
    branchLabel: palace.branchLabel,
    sectorLabel: palace.sectorLabel,
    palaceStemLabel: palace.palaceStemLabel,
    isLifePalace: palace.isLifePalace,
    isBodyPalace: palace.isBodyPalace,
    starCount: stars.length,
    mappedStarCount: stars.length - noFixedTableCount,
    noFixedTableCount,
    counts
  }
}

function buildLevelTotals(
  rows: ZiweiPalaceBrightnessMatrixRow[]
): ZiweiPalaceBrightnessCount[] {
  return STAR_BRIGHTNESS_FILTER_ORDER.map((level) => {
    return {
      level,
      label: STAR_BRIGHTNESS_FILTER_LABELS[level],
      count: rows.reduce((sum, row) => {
        return sum + (row.counts.find((item) => item.level === level)?.count ?? 0)
      }, 0)
    }
  })
}
