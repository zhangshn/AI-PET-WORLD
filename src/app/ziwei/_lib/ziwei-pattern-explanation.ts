import type {
  ZiweiPatternCategory,
  ZiweiPatternMatchView
} from "./ziwei-pattern-catalog"

export type ZiweiPatternExplanationTone = "favorable" | "adverse" | "neutral"

export interface ZiweiPatternExplanationView {
  tone: ZiweiPatternExplanationTone
  headline: string
  focusLines: string[]
  reviewLines: string[]
  sourceLine: string
}

const ADVERSE_PATTERN_CATEGORIES = new Set<ZiweiPatternCategory>([
  "malefic",
  "adverse"
])

const CATEGORY_FOCUS_LINES: Record<ZiweiPatternCategory, string> = {
  literary: "文曜科名类主要观察昌曲、化科与命宫三方四正的会合程度。",
  assistant: "辅佐贵人类主要观察左右、魁钺等辅曜是否能拱扶命宫主结构。",
  mainCombo: "主星组合类主要观察主星同宫、会照或指定地支形成的核心骨架。",
  wealthPower: "禄马权科类主要观察禄、权、科、禄存、天马与命宫范围的联动。",
  malefic: "煞曜结构类主要观察擎羊、陀罗、火星、铃星、空劫、化忌对命宫范围的压力。",
  misc: "杂曜结构类主要观察台辅、封诰、龙池、凤阁、桃花、孤寡等杂曜对命宫范围的辅助或复核意义。",
  adverse: "凶格破格类主要观察命宫、三方四正、同宫结构中的不利星曜组合。",
  pending: "待校准类只保留目录位置，等规则参数确认后再进入正式判定。"
}

export function buildZiweiPatternExplanation(
  match: ZiweiPatternMatchView
): ZiweiPatternExplanationView {
  const tone = getExplanationTone(match)
  const headline = buildHeadline(match, tone)
  const focusLines = uniqueLines([
    CATEGORY_FOCUS_LINES[match.category],
    `判定条件：${match.conditionText}`,
    ...buildEvidenceFocusLines(match)
  ])
  const reviewLines = uniqueLines([
    ...buildStatusReviewLines(match, tone),
    ...buildStrengthReviewLines(match),
    ...buildMissingStarLines(match)
  ])

  return {
    tone,
    headline,
    focusLines,
    reviewLines,
    sourceLine:
      match.sourceRuleIds.length > 0
        ? `来源规则：${match.sourceRuleIds.join(" / ")}`
        : match.status === "pending"
          ? "来源规则：待补正式条件"
          : "来源规则：当前未形成命中来源"
  }
}

function getExplanationTone(
  match: ZiweiPatternMatchView
): ZiweiPatternExplanationTone {
  if (ADVERSE_PATTERN_CATEGORIES.has(match.category)) {
    return "adverse"
  }

  if (match.status === "hit") {
    return "favorable"
  }

  return "neutral"
}

function buildHeadline(
  match: ZiweiPatternMatchView,
  tone: ZiweiPatternExplanationTone
): string {
  if (match.status === "pending") {
    return `${match.label} 暂列目录，等待规则校准后再判定。`
  }

  if (match.status !== "hit") {
    return `${match.label} 当前未成格，先保留条件和缺口用于校盘。`
  }

  if (tone === "adverse") {
    return `${match.label} 已形成不利结构，需要重点复核命宫、三方四正和煞忌来源。`
  }

  return `${match.label} 已形成，继续结合强弱、宫位和星曜来源判断层次。`
}

function buildEvidenceFocusLines(match: ZiweiPatternMatchView): string[] {
  if (match.status === "pending") {
    return ["命中证据：待补充正式判定条件。"]
  }

  if (match.evidenceLines.length === 0) {
    return ["命中证据：当前无可展示证据。"]
  }

  return [`命中证据：${match.evidenceLines.join(" / ")}`]
}

function buildStatusReviewLines(
  match: ZiweiPatternMatchView,
  tone: ZiweiPatternExplanationTone
): string[] {
  if (match.status === "pending") {
    return ["复核要点：先补规则条件，再补样例校验。"]
  }

  if (match.status !== "hit") {
    return ["复核要点：检查缺失星曜、指定地支、同宫、夹拱或三方四正范围。"]
  }

  if (tone === "adverse") {
    return ["复核要点：凶格命中时优先查看是否有吉曜化解、庙旺失陷和所在宫位。"]
  }

  return ["复核要点：吉格命中后继续看是否见加吉、煞忌破格或主星庙旺。"]
}

function buildStrengthReviewLines(match: ZiweiPatternMatchView): string[] {
  if (match.strengthReasonLines.length === 0) {
    return []
  }

  return [`强弱依据：${match.strengthReasonLines.join(" / ")}`]
}

function buildMissingStarLines(match: ZiweiPatternMatchView): string[] {
  if (match.missingStarLabels.length === 0 || match.status === "hit") {
    return []
  }

  return [`缺失星曜：${match.missingStarLabels.join(" / ")}`]
}

function uniqueLines(lines: string[]): string[] {
  return Array.from(new Set(lines.filter(Boolean)))
}
