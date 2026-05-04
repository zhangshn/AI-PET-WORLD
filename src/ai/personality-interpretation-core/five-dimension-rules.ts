/**
 * 当前文件负责：定义生命功能到五维性格的表达规则。
 */

import type {
  FiveDimensionKey,
  FiveDimensionRule,
} from "./interpretation-schema"

export const FIVE_DIMENSION_ORDER: FiveDimensionKey[] = [
  "exploration",
  "attachment",
  "stability",
  "execution",
  "caregiving",
]

export const FIVE_DIMENSION_RULES: Record<
  FiveDimensionKey,
  FiveDimensionRule
> = {
  exploration: {
    key: "exploration",
    label: "探索性",
    baseMeaning: "好奇、外出、尝试新环境、主动接触未知。",
    sourceFunctions: [
      "explorationRange",
      "coreSelf",
    ],
    baziSupportKeys: [
      "explorationDrive",
      "actionIntensity",
      "reactionSpeed",
      "adaptability",
    ],
    vectorSupportKeys: [
      "curiosity",
      "explorationDrive",
      "activity",
      "adaptability",
    ],
  },
  attachment: {
    key: "attachment",
    label: "依附性",
    baseMeaning: "亲密、陪伴、关系绑定、安全连接。",
    sourceFunctions: [
      "longTermBond",
      "innerRecovery",
    ],
    baziSupportKeys: [
      "sensoryDepth",
      "stability",
      "adaptability",
    ],
    vectorSupportKeys: [
      "attachment",
      "sensitivity",
      "stability",
      "restPreference",
    ],
  },
  stability: {
    key: "stability",
    label: "稳定性",
    baseMeaning: "规律、恢复、休息、安全区、情绪平稳。",
    sourceFunctions: [
      "territorySafety",
      "innerRecovery",
    ],
    baziSupportKeys: [
      "stability",
      "consistency",
      "persistence",
    ],
    vectorSupportKeys: [
      "stability",
      "restPreference",
      "persistence",
      "discipline",
    ],
  },
  execution: {
    key: "execution",
    label: "执行性",
    baseMeaning: "目标、边界、推进、完成任务、掌控感。",
    sourceFunctions: [
      "taskExecution",
      "coreSelf",
    ],
    baziSupportKeys: [
      "consistency",
      "persistence",
      "actionIntensity",
      "reactionSpeed",
    ],
    vectorSupportKeys: [
      "discipline",
      "control",
      "persistence",
      "reactionSpeed",
    ],
  },
  caregiving: {
    key: "caregiving",
    label: "照护性",
    baseMeaning: "保护、照看、创造、延续、关心弱小对象。",
    sourceFunctions: [
      "caregivingCreation",
      "longTermBond",
    ],
    baziSupportKeys: [
      "sensoryDepth",
      "stability",
      "persistence",
    ],
    vectorSupportKeys: [
      "attachment",
      "sensitivity",
      "sensoryDepth",
      "stability",
    ],
  },
}