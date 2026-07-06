import type { ZiweiPatternMatchView } from "./ziwei-pattern-catalog"

const ADVERSE_PATTERN_CATEGORIES = new Set(["malefic", "adverse"])

export function sortZiweiPatternMatchesByPriority(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternMatchView[] {
  return matches
    .map((match, index) => ({ index, match }))
    .sort((left, right) => {
      const rankDiff =
        getZiweiPatternPriorityRank(left.match) -
        getZiweiPatternPriorityRank(right.match)

      return rankDiff === 0 ? left.index - right.index : rankDiff
    })
    .map((item) => item.match)
}

export function getZiweiPatternPriorityLabel(
  match: ZiweiPatternMatchView
): string {
  if (
    match.status === "hit" &&
    ADVERSE_PATTERN_CATEGORIES.has(match.category)
  ) {
    return "凶格优先"
  }

  if (match.strength === "broken") {
    return "破格优先"
  }

  if (match.strength === "enhanced") {
    return "增强优先"
  }

  if (match.status === "hit") {
    return "命中优先"
  }

  if (match.status === "pending") {
    return "待校准"
  }

  return "未成格"
}

function getZiweiPatternPriorityRank(match: ZiweiPatternMatchView): number {
  if (
    match.status === "hit" &&
    ADVERSE_PATTERN_CATEGORIES.has(match.category)
  ) {
    return 0
  }

  if (match.strength === "broken") {
    return 1
  }

  if (match.strength === "enhanced") {
    return 2
  }

  if (match.status === "hit") {
    return 3
  }

  if (match.status === "pending") {
    return 4
  }

  return 5
}
