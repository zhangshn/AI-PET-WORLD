/**
 * 当前文件负责：生成紫微当前流动人格与行动趋向的中文摘要。
 */

import type {
  CurrentDynamicFlowSummary
} from "./current-dynamic-profile-schema"

import type {
  ZiweiFlowType
} from "../dynamic-schema"

const FLOW_LABELS: Record<ZiweiFlowType, string> = {
  natal: "本命底盘",
  daYun: "大运阶段",
  liuNian: "流年主题",
  liuYue: "流月状态",
  liuRi: "流日触发",
  liuShi: "流时即时偏移"
}

export function getDynamicFlowLabel(type: ZiweiFlowType): string {
  return FLOW_LABELS[type]
}

export function buildCurrentDynamicProfileSummary(params: {
  dominantFlow: CurrentDynamicFlowSummary
  temporalDominantFlow: CurrentDynamicFlowSummary | null
  phase: string
  focus: string
}): string {
  const dominantLabel = getDynamicFlowLabel(params.dominantFlow.type)

  if (!params.temporalDominantFlow) {
    return [
      `当前以${dominantLabel}为主要底盘。`,
      `当前阶段为${params.phase}，关注点集中在${params.focus}。`
    ].join("")
  }

  const temporalLabel = getDynamicFlowLabel(params.temporalDominantFlow.type)

  return [
    `当前以${dominantLabel}为生命底盘，`,
    `${temporalLabel}形成当前时间层的主要偏移。`,
    `当前阶段为${params.phase}，关注点集中在${params.focus}。`
  ].join("")
}