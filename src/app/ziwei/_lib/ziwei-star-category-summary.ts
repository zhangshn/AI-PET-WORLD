import type {
  ZiweiStarCatalogRowView,
  ZiweiStarCategory
} from "@/ai/destiny-core/ziwei-core/contracts"

export interface ZiweiStarCategorySummary {
  category: ZiweiStarCategory
  categoryLabel: string
  starCount: number
  palaceCount: number
  ruleCount: number
  palaceLabels: string[]
}

export function buildStarCategorySummaries(
  rows: ZiweiStarCatalogRowView[]
): ZiweiStarCategorySummary[] {
  const groupedRows = new Map<ZiweiStarCategory, ZiweiStarCatalogRowView[]>()

  rows.forEach((row) => {
    groupedRows.set(row.category, [...(groupedRows.get(row.category) ?? []), row])
  })

  return Array.from(groupedRows.entries()).map(([category, categoryRows]) => {
    const rules = categoryRows
      .map((row) => row.placementRuleId)
      .filter((ruleId): ruleId is string => Boolean(ruleId))
    const palaceLabels = unique(categoryRows.map(formatPalaceLabel))

    return {
      category,
      categoryLabel: categoryRows[0]?.categoryLabel ?? category,
      starCount: categoryRows.length,
      palaceCount: palaceLabels.length,
      ruleCount: unique(rules).length,
      palaceLabels
    }
  })
}

export function countStarCategoryRules(
  summaries: ZiweiStarCategorySummary[]
): number {
  return summaries.reduce((count, summary) => {
    return count + summary.ruleCount
  }, 0)
}

function formatPalaceLabel(row: ZiweiStarCatalogRowView): string {
  return `${row.palaceLabel ?? "未落宫"} · ${row.sectorLabel ?? "未归类"}`
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
