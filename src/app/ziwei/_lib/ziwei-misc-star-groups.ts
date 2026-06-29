import type { ZiweiStarCatalogRowView } from "@/ai/destiny-core/ziwei-core/contracts"

export type ZiweiMiscStarGroupKey =
  | "romance"
  | "nobleman"
  | "solitary"
  | "punishment"
  | "unknown"

export interface ZiweiMiscStarGroupView {
  key: ZiweiMiscStarGroupKey
  label: string
  rows: ZiweiStarCatalogRowView[]
}

const MISC_STAR_GROUP_ORDER: ZiweiMiscStarGroupKey[] = [
  "romance",
  "nobleman",
  "solitary",
  "punishment",
  "unknown"
]

const MISC_STAR_GROUP_LABELS: Record<ZiweiMiscStarGroupKey, string> = {
  romance: "桃花喜庆类",
  nobleman: "贵人与仪制类",
  solitary: "孤寡类",
  punishment: "刑耗哭虚类",
  unknown: "未归类杂曜"
}

export function buildMiscStarGroups(
  rows: ZiweiStarCatalogRowView[]
): ZiweiMiscStarGroupView[] {
  const groups = new Map<ZiweiMiscStarGroupKey, ZiweiStarCatalogRowView[]>()

  rows.forEach((row) => {
    if (row.category !== "misc") {
      return
    }

    const key = getMiscStarGroupKey(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  })

  return MISC_STAR_GROUP_ORDER.map((key) => {
    return {
      key,
      label: MISC_STAR_GROUP_LABELS[key],
      rows: groups.get(key) ?? []
    }
  }).filter((group) => group.rows.length > 0)
}

export function countMiscSourceRules(rows: ZiweiStarCatalogRowView[]): number {
  return new Set(
    rows
      .filter((row) => row.category === "misc")
      .map((row) => row.placementRuleId)
      .filter(Boolean)
  ).size
}

export function countMiscPalaces(rows: ZiweiStarCatalogRowView[]): number {
  return new Set(
    rows
      .filter((row) => row.category === "misc")
      .map((row) => `${row.palaceLabel ?? ""}::${row.sectorLabel ?? ""}`)
  ).size
}

function getMiscStarGroupKey(
  row: ZiweiStarCatalogRowView
): ZiweiMiscStarGroupKey {
  const key = row.placementRuleId?.match(/^misc\.([^.]+)/)?.[1]

  if (
    key === "romance" ||
    key === "nobleman" ||
    key === "solitary" ||
    key === "punishment"
  ) {
    return key
  }

  return "unknown"
}
