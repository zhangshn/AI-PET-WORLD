import type {
  ZiweiPatternCategory,
  ZiweiPatternMatchView
} from "./ziwei-pattern-catalog"
import { buildZiweiPatternExplanation } from "./ziwei-pattern-explanation"

export interface ZiweiPatternGapView {
  patternId: string
  label: string
  category: ZiweiPatternCategory
  categoryLabel: string
  statusLabel: string
  conditionText: string
  missingStarLabels: string[]
  evidenceLines: string[]
  reviewLines: string[]
  matchedPalaceLabels: string[]
  sourceRuleIds: string[]
}

export interface ZiweiPatternGapSummary {
  totalCount: number
  missCount: number
  pendingCount: number
  missingStarCount: number
  sourceRuleCount: number
}

export function buildZiweiPatternGaps(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternGapView[] {
  return matches
    .filter((match) => match.status !== "hit")
    .map((match) => {
      const explanation = buildZiweiPatternExplanation(match)

      return {
        patternId: match.id,
        label: match.label,
        category: match.category,
        categoryLabel: match.categoryLabel,
        statusLabel: match.status === "pending" ? "待校准" : "未成格",
        conditionText: match.conditionText,
        missingStarLabels: match.missingStarLabels,
        evidenceLines: match.evidenceLines,
        reviewLines: explanation.reviewLines,
        matchedPalaceLabels: match.matchedPalaceLabels,
        sourceRuleIds: match.sourceRuleIds
      }
    })
}

export function summarizeZiweiPatternGaps(
  gaps: ZiweiPatternGapView[]
): ZiweiPatternGapSummary {
  return {
    totalCount: gaps.length,
    missCount: gaps.filter((gap) => gap.statusLabel === "未成格").length,
    pendingCount: gaps.filter((gap) => gap.statusLabel === "待校准").length,
    missingStarCount: new Set(
      gaps.flatMap((gap) => gap.missingStarLabels)
    ).size,
    sourceRuleCount: new Set(gaps.flatMap((gap) => gap.sourceRuleIds)).size
  }
}
