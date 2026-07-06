import type {
  ZiweiStarBrightnessLevel,
  ZiweiStarCatalogRowView
} from "@/ai/destiny-core/ziwei-core/contracts"

export type StarCatalogBrightnessFilter = ZiweiStarBrightnessLevel | "all"

export interface ZiweiStarBrightnessSummary {
  level: ZiweiStarBrightnessLevel
  label: string
  starCount: number
  palaceCount: number
  categoryCount: number
  sourceRuleCount: number
  palaceLabels: string[]
  categoryLabels: string[]
}

export const STAR_BRIGHTNESS_FILTER_ORDER = [
  "miao",
  "wang",
  "de",
  "li",
  "ping",
  "bu",
  "xian",
  "unmapped"
] as const satisfies readonly ZiweiStarBrightnessLevel[]

export const STAR_BRIGHTNESS_FILTER_LABELS: Record<
  StarCatalogBrightnessFilter,
  string
> = {
  all: "全部庙旺",
  miao: "庙",
  wang: "旺",
  de: "得",
  li: "利",
  ping: "平",
  bu: "不",
  xian: "陷",
  unmapped: "不论"
}

export function buildStarCatalogBrightnessFilterValues(
  rows: ZiweiStarCatalogRowView[]
): StarCatalogBrightnessFilter[] {
  const levels = new Set<StarCatalogBrightnessFilter>(["all"])

  rows.forEach((row) => {
    levels.add(row.brightness?.level ?? "unmapped")
  })

  return [
    "all",
    ...STAR_BRIGHTNESS_FILTER_ORDER.filter((level) => levels.has(level))
  ]
}

export function buildStarBrightnessSummaries(
  rows: ZiweiStarCatalogRowView[]
): ZiweiStarBrightnessSummary[] {
  const groupedRows = new Map<
    ZiweiStarBrightnessLevel,
    ZiweiStarCatalogRowView[]
  >()

  rows.forEach((row) => {
    const level = row.brightness?.level ?? "unmapped"
    groupedRows.set(level, [...(groupedRows.get(level) ?? []), row])
  })

  return STAR_BRIGHTNESS_FILTER_ORDER
    .map((level) => {
      const levelRows = groupedRows.get(level) ?? []
      const palaceLabels = unique(levelRows.map(formatPalaceLabel))
      const categoryLabels = unique(levelRows.map((row) => row.categoryLabel))
      const sourceRuleIds = levelRows
        .map((row) => row.brightness?.sourceRuleId)
        .filter((ruleId): ruleId is string => Boolean(ruleId))

      return {
        level,
        label: STAR_BRIGHTNESS_FILTER_LABELS[level],
        starCount: levelRows.length,
        palaceCount: palaceLabels.length,
        categoryCount: categoryLabels.length,
        sourceRuleCount: unique(sourceRuleIds).length,
        palaceLabels,
        categoryLabels
      }
    })
    .filter((summary) => summary.starCount > 0)
}

export function getStarBrightnessFilterLabel(
  filter: StarCatalogBrightnessFilter
): string {
  return STAR_BRIGHTNESS_FILTER_LABELS[filter] ?? filter
}

function formatPalaceLabel(row: ZiweiStarCatalogRowView): string {
  return `${row.palaceLabel ?? "未落宫"} · ${row.sectorLabel ?? "未归类"}`
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
