import type {
  ZiweiStarCatalogRowView,
  ZiweiStarCategory
} from "@/ai/destiny-core/ziwei-core/contracts"

export interface ZiweiRuleSourceIndexRow {
  ruleId: string
  category: ZiweiStarCategory
  categoryLabel: string
  starLabels: string[]
  palaceLabels: string[]
  count: number
}

export interface ZiweiRuleSourceCategoryGroup {
  category: ZiweiStarCategory
  categoryLabel: string
  rules: ZiweiRuleSourceIndexRow[]
}

export function buildRuleSourceIndex(
  rows: ZiweiStarCatalogRowView[]
): ZiweiRuleSourceCategoryGroup[] {
  const groupedRules = new Map<string, ZiweiRuleSourceIndexRow>()

  rows.forEach((row) => {
    if (!row.placementRuleId) {
      return
    }

    const key = `${row.category}::${row.placementRuleId}`
    const existing = groupedRules.get(key)
    const palaceLabel = formatPalaceLabel(row)

    if (existing) {
      existing.count += 1
      existing.starLabels = appendUnique(existing.starLabels, row.label)
      existing.palaceLabels = appendUnique(existing.palaceLabels, palaceLabel)
      return
    }

    groupedRules.set(key, {
      ruleId: row.placementRuleId,
      category: row.category,
      categoryLabel: row.categoryLabel,
      starLabels: [row.label],
      palaceLabels: [palaceLabel],
      count: 1
    })
  })

  const groupedCategories = new Map<ZiweiStarCategory, ZiweiRuleSourceIndexRow[]>()

  Array.from(groupedRules.values()).forEach((rule) => {
    groupedCategories.set(rule.category, [
      ...(groupedCategories.get(rule.category) ?? []),
      rule
    ])
  })

  return Array.from(groupedCategories.entries()).map(([category, rules]) => {
    const sortedRules = [...rules].sort((left, right) => {
      return left.ruleId.localeCompare(right.ruleId)
    })

    return {
      category,
      categoryLabel: sortedRules[0]?.categoryLabel ?? category,
      rules: sortedRules
    }
  })
}

export function countRuleSourcePalaces(
  groups: ZiweiRuleSourceCategoryGroup[]
): number {
  return new Set(
    groups.flatMap((group) => {
      return group.rules.flatMap((rule) => rule.palaceLabels)
    })
  ).size
}

function formatPalaceLabel(row: ZiweiStarCatalogRowView): string {
  return `${row.palaceLabel ?? "未落宫"} · ${row.sectorLabel ?? "未归类"}`
}

function appendUnique(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values
  }

  return [...values, value]
}
