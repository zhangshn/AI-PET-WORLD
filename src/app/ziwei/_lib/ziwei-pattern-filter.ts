import {
  ZIWEI_PATTERN_CATEGORY_LABELS,
  type ZiweiPatternCategory
} from "./ziwei-pattern-catalog"

export type PatternFilterValue =
  | "all"
  | "hit"
  | "enhanced"
  | "broken"
  | "miss"
  | `category:${ZiweiPatternCategory}`

const PATTERN_STATUS_FILTER_LABELS: Record<
  Exclude<PatternFilterValue, `category:${ZiweiPatternCategory}`>,
  string
> = {
  all: "全部格局",
  hit: "命中",
  enhanced: "加吉增强",
  broken: "煞忌破格",
  miss: "未成格"
}

export function buildPatternFilterValues(): PatternFilterValue[] {
  return [
    "all",
    "hit",
    "enhanced",
    "broken",
    "miss",
    ...Object.keys(ZIWEI_PATTERN_CATEGORY_LABELS).map((category) => {
      return `category:${category as ZiweiPatternCategory}` as const
    })
  ]
}

export function getPatternFilterLabel(filter: PatternFilterValue): string {
  if (
    filter === "all" ||
    filter === "hit" ||
    filter === "enhanced" ||
    filter === "broken" ||
    filter === "miss"
  ) {
    return PATTERN_STATUS_FILTER_LABELS[filter]
  }

  const category = filter.replace("category:", "") as ZiweiPatternCategory

  return ZIWEI_PATTERN_CATEGORY_LABELS[category] ?? filter
}
