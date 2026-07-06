import type { ZiweiPatternMatchView } from "./ziwei-pattern-catalog"
import {
  buildZiweiPatternStatistics,
  type ZiweiPatternStatisticsView
} from "./ziwei-pattern-statistics"
import { sortZiweiPatternMatchesByPriority } from "./ziwei-pattern-priority"

export interface ZiweiPatternExportSummary {
  title: string
  lines: string[]
  text: string
}

const ADVERSE_CATEGORY_LABELS = new Set(["煞曜结构", "凶格破格"])

export function buildZiweiPatternExportSummary(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternExportSummary {
  const sortedMatches = sortZiweiPatternMatchesByPriority(matches)
  const statistics = buildZiweiPatternStatistics(matches)
  const lines = [
    "紫微斗数格局命中摘要",
    formatTotalLine(statistics),
    "",
    ...formatCategoryLines(statistics),
    "",
    ...formatMatchGroup("命中格局", getHitMatches(sortedMatches)),
    "",
    ...formatMatchGroup("凶格与煞曜结构", getAdverseHitMatches(sortedMatches)),
    "",
    ...formatMatchGroup("加吉增强", getStrengthMatches(sortedMatches, "enhanced")),
    "",
    ...formatMatchGroup("煞忌破格", getStrengthMatches(sortedMatches, "broken"))
  ]

  return {
    title: "格局命中摘要",
    lines,
    text: lines.join("\n")
  }
}

function formatTotalLine(statistics: ZiweiPatternStatisticsView): string {
  return [
    `格局总数：${statistics.totalCount}`,
    `命中：${statistics.hitCount}`,
    `未成格：${statistics.missCount}`,
    `加吉增强：${statistics.enhancedCount}`,
    `煞忌破格：${statistics.brokenCount}`,
    `凶格命中：${statistics.adverseHitCount}`
  ].join("；")
}

function formatCategoryLines(statistics: ZiweiPatternStatisticsView): string[] {
  return [
    "分类统计：",
    ...statistics.categoryStats.map((category) => {
      return [
        `- ${category.categoryLabel}`,
        `总数 ${category.totalCount}`,
        `命中 ${category.hitCount}`,
        `未成 ${category.missCount}`,
        `增强 ${category.enhancedCount}`,
        `破格 ${category.brokenCount}`,
        `待校 ${category.pendingCount}`
      ].join("；")
    })
  ]
}

function formatMatchGroup(
  title: string,
  matches: ZiweiPatternMatchView[]
): string[] {
  if (matches.length === 0) {
    return [`${title}：无`]
  }

  return [
    `${title}：`,
    ...matches.map((match) => {
      const palaceText =
        match.matchedPalaceLabels.length > 0
          ? `；宫位 ${match.matchedPalaceLabels.join(" / ")}`
          : ""

      return `- ${match.label}（${match.categoryLabel} / ${match.strengthLabel}）${palaceText}`
    })
  ]
}

function getHitMatches(matches: ZiweiPatternMatchView[]): ZiweiPatternMatchView[] {
  return matches.filter((match) => match.status === "hit")
}

function getAdverseHitMatches(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternMatchView[] {
  return matches.filter((match) => {
    return (
      match.status === "hit" && ADVERSE_CATEGORY_LABELS.has(match.categoryLabel)
    )
  })
}

function getStrengthMatches(
  matches: ZiweiPatternMatchView[],
  strength: ZiweiPatternMatchView["strength"]
): ZiweiPatternMatchView[] {
  return matches.filter((match) => match.strength === strength)
}
