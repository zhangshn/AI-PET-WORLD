import type {
  ZiweiStarCategory,
  ZiweiStarGroupView
} from "@/ai/destiny-core/ziwei-core/contracts"

export const CORE_DETAIL_CATEGORIES = new Set<ZiweiStarCategory>([
  "main",
  "assistant",
  "malefic",
  "transformation",
  "misc"
])

export const FLOW_DETAIL_CATEGORIES = new Set<ZiweiStarCategory>([
  "lifecycle",
  "yearly",
  "monthly",
  "dailyHourly"
])

export function filterStarGroups(
  groups: ZiweiStarGroupView[],
  categories: ReadonlySet<ZiweiStarCategory>
): ZiweiStarGroupView[] {
  return groups.filter((group) => categories.has(group.category))
}

export function countStars(groups: ZiweiStarGroupView[]): number {
  return groups.reduce((count, group) => {
    return count + group.stars.length
  }, 0)
}

export function countSourceRules(groups: ZiweiStarGroupView[]): number {
  return new Set(
    groups.flatMap((group) => {
      return group.stars.map((star) => star.placementRuleId)
    })
  ).size
}
