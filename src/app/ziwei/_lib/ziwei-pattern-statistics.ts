import type {
  ZiweiPatternCategory,
  ZiweiPatternMatchView
} from "./ziwei-pattern-catalog"

export interface ZiweiPatternCategoryStatistic {
  category: ZiweiPatternCategory
  categoryLabel: string
  totalCount: number
  hitCount: number
  missCount: number
  enhancedCount: number
  brokenCount: number
  pendingCount: number
}

export interface ZiweiPatternStatisticsView {
  totalCount: number
  hitCount: number
  missCount: number
  enhancedCount: number
  brokenCount: number
  adverseHitCount: number
  categoryStats: ZiweiPatternCategoryStatistic[]
}

const ADVERSE_PATTERN_CATEGORIES = new Set<ZiweiPatternCategory>([
  "malefic",
  "adverse"
])

export function buildZiweiPatternStatistics(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternStatisticsView {
  const categoryStats = Array.from(groupMatchesByCategory(matches)).map(
    ([category, categoryMatches]) => {
      return {
        category,
        categoryLabel: categoryMatches[0]?.categoryLabel ?? category,
        totalCount: categoryMatches.length,
        hitCount: countMatches(categoryMatches, (match) => {
          return match.status === "hit"
        }),
        missCount: countMatches(categoryMatches, (match) => {
          return match.status === "miss"
        }),
        enhancedCount: countMatches(categoryMatches, (match) => {
          return match.strength === "enhanced"
        }),
        brokenCount: countMatches(categoryMatches, (match) => {
          return match.strength === "broken"
        }),
        pendingCount: countMatches(categoryMatches, (match) => {
          return match.status === "pending"
        })
      }
    }
  )

  return {
    totalCount: matches.length,
    hitCount: countMatches(matches, (match) => match.status === "hit"),
    missCount: countMatches(matches, (match) => match.status === "miss"),
    enhancedCount: countMatches(matches, (match) => {
      return match.strength === "enhanced"
    }),
    brokenCount: countMatches(matches, (match) => {
      return match.strength === "broken"
    }),
    adverseHitCount: countMatches(matches, (match) => {
      return (
        match.status === "hit" && ADVERSE_PATTERN_CATEGORIES.has(match.category)
      )
    }),
    categoryStats
  }
}

function groupMatchesByCategory(
  matches: ZiweiPatternMatchView[]
): Map<ZiweiPatternCategory, ZiweiPatternMatchView[]> {
  const groups = new Map<ZiweiPatternCategory, ZiweiPatternMatchView[]>()

  matches.forEach((match) => {
    groups.set(match.category, [...(groups.get(match.category) ?? []), match])
  })

  return groups
}

function countMatches(
  matches: ZiweiPatternMatchView[],
  predicate: (match: ZiweiPatternMatchView) => boolean
): number {
  return matches.filter(predicate).length
}
