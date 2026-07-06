import { getPatternContentDetail } from "@/ai/destiny-core/ziwei-core/interpretation"

import type { ZiweiPatternMatchView } from "./ziwei-pattern-catalog"

export interface ZiweiPatternDetailedAnalysisView {
  patternId: string
  label: string
  tone: "favorable" | "adverse" | "mixed" | "pending"
  statusLine: string
  structureLines: string[]
  effectLines: string[]
  breakLines: string[]
  reviewLines: string[]
}

export function buildZiweiPatternDetailedAnalysis(
  match: ZiweiPatternMatchView
): ZiweiPatternDetailedAnalysisView {
  const content = getPatternContentDetail({
    id: match.id,
    label: match.label,
    category: match.category,
    conditionText: match.conditionText
  })

  return {
    patternId: match.id,
    label: match.label,
    tone: content.tone,
    statusLine: buildStatusLine(match),
    structureLines: buildStructureLines(match, content.coreThemes),
    effectLines: buildEffectLines(match, content),
    breakLines: buildBreakLines(match, content),
    reviewLines: buildReviewLines(match, content.readingNotes)
  }
}

export function buildZiweiPatternDetailedAnalyses(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternDetailedAnalysisView[] {
  return matches.map(buildZiweiPatternDetailedAnalysis)
}

function buildStatusLine(match: ZiweiPatternMatchView): string {
  if (match.status === "pending") {
    return `${match.label} 当前为待校准格局，只保留目录和复核入口。`
  }

  if (match.status !== "hit") {
    return `${match.label} 当前未成格，重点查看缺失星曜、宫位范围和判定条件。`
  }

  if (match.strength === "broken") {
    return `${match.label} 已命中但存在煞忌破格，需要优先复核压力来源。`
  }

  if (match.strength === "enhanced") {
    return `${match.label} 已命中且见加吉增强，可继续观察成格层次。`
  }

  return `${match.label} 已命中，需结合宫位、星曜来源和强弱层次分析。`
}

function buildStructureLines(
  match: ZiweiPatternMatchView,
  coreThemes: string[]
): string[] {
  return [
    "解释边界：总格局字典只说明该格局本体；当前盘中解释必须回到本盘命中证据、命宫、三方四正、同宫星曜、四化和庙旺落陷。",
    `结构主题：${coreThemes.join("、")}。`,
    `判定条件：${match.conditionText}`,
    match.matchedPalaceLabels.length > 0
      ? `命中宫位：${match.matchedPalaceLabels.join("、")}。`
      : "命中宫位：当前未形成。"
  ]
}

function buildEffectLines(
  match: ZiweiPatternMatchView,
  content: ReturnType<typeof getPatternContentDetail>
): string[] {
  if (match.status !== "hit") {
    return [
      content.nature,
      `未成格时先保留观察：${content.risks.slice(0, 2).join("、")}。`
    ]
  }

  return [
    content.nature,
    `优势观察：${content.strengths.slice(0, 3).join("、")}。`,
    `增强信号：${content.enhancementSignals.slice(0, 3).join("、")}。`
  ]
}

function buildBreakLines(
  match: ZiweiPatternMatchView,
  content: ReturnType<typeof getPatternContentDetail>
): string[] {
  const lines = [
    `破格/风险信号：${content.breakSignals.slice(0, 3).join("、")}。`
  ]

  if (match.strength === "broken") {
    lines.push(`破格依据：${match.strengthReasonLines.join(" / ") || "煞忌结构命中"}。`)
  }

  if (match.category === "adverse" || match.category === "malefic") {
    lines.push(`不良结构复核：${content.risks.slice(0, 3).join("、")}。`)
  }

  return lines
}

function buildReviewLines(
  match: ZiweiPatternMatchView,
  readingNotes: string[]
): string[] {
  return [
    ...readingNotes.slice(0, 3),
    match.sourceRuleIds.length > 0
      ? `来源规则：${match.sourceRuleIds.join(" / ")}`
      : match.status === "pending"
        ? "来源规则：待补正式条件"
        : "来源规则：当前未形成命中来源"
  ]
}
