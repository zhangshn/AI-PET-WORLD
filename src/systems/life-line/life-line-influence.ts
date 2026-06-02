/**
 * 当前文件负责：把生命运行动态包收束成运行系统可读取的纵向生命线影响快照。
 *
 * 注意：
 * 生命线影响不是命令。
 * 大运 / 流年 / 流月 / 流日只形成长期倾向与解释背景，不直接决定 action / task。
 */

import type {
  CurrentLifeRuntimeBundle,
} from "@/ai/ai-system-gateway"

export type LifeLineInfluenceFocus =
  | "explore"
  | "observe"
  | "approach"
  | "recover"
  | "care"
  | "protect"
  | "boundary"
  | "routine"
  | "action"
  | "perception"

export type LifeLineInfluenceSnapshot = {
  focus: LifeLineInfluenceFocus[]
  dominantFocus: LifeLineInfluenceFocus | null
  intensity: number
  phaseSummary: string
  runtimeLabels: {
    daYun: string
    liuNian: string
    liuYue: string
    liuRi: string
    liuShi: string
  }
  tendencyBias: Partial<Record<LifeLineInfluenceFocus, number>>
  summary: string
  reasons: string[]
  tags: string[]
}

function clampInfluence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function toFocus(value: string): LifeLineInfluenceFocus | null {
  if (
    value === "explore" ||
    value === "observe" ||
    value === "approach" ||
    value === "recover" ||
    value === "care" ||
    value === "protect" ||
    value === "boundary" ||
    value === "routine" ||
    value === "action" ||
    value === "perception"
  ) {
    return value
  }

  return null
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function buildLifeLineInfluenceSnapshot(
  bundle: CurrentLifeRuntimeBundle | null | undefined
): LifeLineInfluenceSnapshot | null {
  if (!bundle) return null

  const topItems = bundle.lifeTendencyProfile.topTendencies.slice(0, 4)
  const focus = unique(
    topItems
      .map((item) => toFocus(item.key))
      .filter((item): item is LifeLineInfluenceFocus => item !== null)
  )
  const dominantFocus = focus[0] ?? null
  const dominantScore = topItems[0]?.score ?? 0
  const tendencyBias: Partial<Record<LifeLineInfluenceFocus, number>> = {}

  for (const item of topItems) {
    const key = toFocus(item.key)
    if (!key) continue

    tendencyBias[key] = clampInfluence((item.score - 50) * 0.35)
  }

  const runtimeLabels = {
    daYun:
      bundle.baziRuntimeProfile.daYun.currentDaYun?.pillar.label ??
      "未起运",
    liuNian: bundle.baziRuntimeProfile.flows.liuNian.label,
    liuYue: bundle.baziRuntimeProfile.flows.liuYue.label,
    liuRi: bundle.baziRuntimeProfile.flows.liuRi.label,
    liuShi: bundle.baziRuntimeProfile.flows.liuShi?.label ?? "未知",
  }

  const reasons = [
    bundle.lifeTendencyProfile.labels.topSummary,
    bundle.lifeTendencyProfile.labels.gameUsage,
    `当前运行层：大运=${runtimeLabels.daYun}，流年=${runtimeLabels.liuNian}，流月=${runtimeLabels.liuYue}，流日=${runtimeLabels.liuRi}，流时=${runtimeLabels.liuShi}。`,
  ]

  return {
    focus,
    dominantFocus,
    intensity: clampInfluence(dominantScore),
    phaseSummary: bundle.lifeTendencyProfile.labels.summary,
    runtimeLabels,
    tendencyBias,
    summary: dominantFocus
      ? `当前生命线偏向 ${dominantFocus}，只作为长期倾向背景。`
      : "当前生命线没有形成明确单一主导倾向。",
    reasons: reasons.slice(0, 5),
    tags: unique([
      "life_line_influence",
      dominantFocus ? `life_focus_${dominantFocus}` : "life_focus_none",
      `da_yun_${runtimeLabels.daYun}`,
      `liu_nian_${runtimeLabels.liuNian}`,
      "not_command",
    ]).slice(0, 24),
  }
}
