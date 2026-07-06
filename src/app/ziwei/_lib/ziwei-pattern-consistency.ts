import type { ZiweiPalaceDetailView } from "@/ai/destiny-core/ziwei-core/contracts"

import {
  ZIWEI_PATTERN_DEFINITIONS,
  type ZiweiPatternMatchView
} from "./ziwei-pattern-catalog"
import { buildZiweiPatternExportSummary } from "./ziwei-pattern-export-summary"
import { buildZiweiPatternGaps } from "./ziwei-pattern-gaps"
import { buildZiweiPatternPalaceSummary } from "./ziwei-pattern-palace-summary"
import { buildZiweiPatternSourceIndex } from "./ziwei-pattern-source-index"
import { buildZiweiPatternStatistics } from "./ziwei-pattern-statistics"

export type ZiweiPatternConsistencyStatus = "pass" | "warn" | "fail"

export interface ZiweiPatternConsistencyCheck {
  id: string
  label: string
  status: ZiweiPatternConsistencyStatus
  detail: string
}

export interface ZiweiPatternConsistencyReport {
  status: ZiweiPatternConsistencyStatus
  passCount: number
  warnCount: number
  failCount: number
  checks: ZiweiPatternConsistencyCheck[]
}

export function buildZiweiPatternConsistencyReport(params: {
  palaces: ZiweiPalaceDetailView[]
  matches: ZiweiPatternMatchView[]
}): ZiweiPatternConsistencyReport {
  const statistics = buildZiweiPatternStatistics(params.matches)
  const gaps = buildZiweiPatternGaps(params.matches)
  const palaceSummary = buildZiweiPatternPalaceSummary(params)
  const sourceRows = buildZiweiPatternSourceIndex(params.matches)
  const exportSummary = buildZiweiPatternExportSummary(params.matches)
  const checks = [
    buildCountCheck({
      id: "catalog-match-count",
      label: "格局目录与匹配结果",
      actual: params.matches.length,
      expected: ZIWEI_PATTERN_DEFINITIONS.length
    }),
    buildCountCheck({
      id: "statistics-total-count",
      label: "统计总数与匹配结果",
      actual: statistics.totalCount,
      expected: params.matches.length
    }),
    buildCountCheck({
      id: "gap-count",
      label: "缺口数量与未命中结果",
      actual: gaps.length,
      expected: params.matches.filter((match) => match.status !== "hit").length
    }),
    buildCountCheck({
      id: "source-index-count",
      label: "来源索引与格局目录",
      actual: sourceRows.length,
      expected: ZIWEI_PATTERN_DEFINITIONS.length
    }),
    buildCountCheck({
      id: "palace-hit-count",
      label: "宫位聚合命中数与统计",
      actual: palaceSummary.totalHitCount,
      expected: statistics.hitCount
    }),
    buildCountCheck({
      id: "palace-broken-count",
      label: "宫位聚合破格数与统计",
      actual: palaceSummary.totalBrokenCount,
      expected: statistics.brokenCount
    }),
    buildCountCheck({
      id: "palace-gap-count",
      label: "宫位聚合缺口数与缺口面板",
      actual: palaceSummary.totalGapCount,
      expected: gaps.length
    }),
    buildUniqueIdCheck(params.matches),
    buildPalaceReferenceCheck(params.matches, params.palaces),
    buildExportSummaryCheck(exportSummary.lines.length)
  ]
  const failCount = checks.filter((check) => check.status === "fail").length
  const warnCount = checks.filter((check) => check.status === "warn").length

  return {
    status: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    passCount: checks.filter((check) => check.status === "pass").length,
    warnCount,
    failCount,
    checks
  }
}

function buildCountCheck(params: {
  id: string
  label: string
  actual: number
  expected: number
}): ZiweiPatternConsistencyCheck {
  const matched = params.actual === params.expected

  return {
    id: params.id,
    label: params.label,
    status: matched ? "pass" : "fail",
    detail: matched
      ? `一致：${params.actual}`
      : `不一致：当前 ${params.actual}，期望 ${params.expected}`
  }
}

function buildUniqueIdCheck(
  matches: ZiweiPatternMatchView[]
): ZiweiPatternConsistencyCheck {
  const ids = matches.map((match) => match.id)
  const uniqueIds = new Set(ids)
  const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index)

  return {
    id: "unique-pattern-ids",
    label: "格局 ID 唯一性",
    status: duplicated.length > 0 ? "fail" : "pass",
    detail:
      duplicated.length > 0
        ? `重复：${Array.from(new Set(duplicated)).join(" / ")}`
        : `一致：${uniqueIds.size} 个唯一 ID`
  }
}

function buildPalaceReferenceCheck(
  matches: ZiweiPatternMatchView[],
  palaces: ZiweiPalaceDetailView[]
): ZiweiPatternConsistencyCheck {
  const palaceBranches = new Set(palaces.map((palace) => palace.branch))
  const unknownBranches = matches.flatMap((match) => {
    return match.matchedPalaces
      .filter((palace) => !palaceBranches.has(palace.branch))
      .map((palace) => `${match.id}:${palace.branch}`)
  })

  return {
    id: "palace-reference",
    label: "格局关联宫位",
    status: unknownBranches.length > 0 ? "fail" : "pass",
    detail:
      unknownBranches.length > 0
        ? `未知宫位：${unknownBranches.join(" / ")}`
        : "一致：所有关联宫位都存在于十二宫 ViewModel"
  }
}

function buildExportSummaryCheck(lineCount: number): ZiweiPatternConsistencyCheck {
  return {
    id: "export-summary-lines",
    label: "导出摘要可用性",
    status: lineCount > 0 ? "pass" : "warn",
    detail: lineCount > 0 ? `可用：${lineCount} 行` : "导出摘要为空"
  }
}
