import type { ZiweiStarCatalogRowView } from "@/ai/destiny-core/ziwei-core/contracts"

export interface ZiweiSameNameStarGroup {
  label: string
  rows: ZiweiStarCatalogRowView[]
  categoryLabels: string[]
  ruleIds: string[]
  palaceLabels: string[]
}

export function buildSameNameStarGroups(
  rows: ZiweiStarCatalogRowView[]
): ZiweiSameNameStarGroup[] {
  const groupedRows = new Map<string, ZiweiStarCatalogRowView[]>()

  rows.forEach((row) => {
    groupedRows.set(row.label, [...(groupedRows.get(row.label) ?? []), row])
  })

  return Array.from(groupedRows.entries())
    .filter(([, groupRows]) => {
      return new Set(groupRows.map((row) => row.starId)).size > 1
    })
    .map(([label, groupRows]) => {
      return {
        label,
        rows: groupRows,
        categoryLabels: unique(groupRows.map((row) => row.categoryLabel)),
        ruleIds: unique(
          groupRows
            .map((row) => row.placementRuleId)
            .filter((ruleId): ruleId is string => Boolean(ruleId))
        ),
        palaceLabels: unique(groupRows.map(formatPalaceLabel))
      }
    })
    .sort((left, right) => {
      return right.rows.length - left.rows.length || compareText(left.label, right.label)
    })
}

function formatPalaceLabel(row: ZiweiStarCatalogRowView): string {
  return `${row.palaceLabel ?? "未落宫"} · ${row.sectorLabel ?? "未归类"}`
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}
