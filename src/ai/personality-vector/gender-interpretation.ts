/**
 * 当前文件负责：把统一人格向量转换为男命 / 女命解释视角。
 */

import type {
  FinalPersonalityVector,
  GenderInterpretationViewpoint,
  GenderLifeFunctionDimension,
  GenderPersonalityDimensionView,
  GenderPersonalityInterpretation,
} from "./vector-types"

type DimensionRule = {
  key: GenderLifeFunctionDimension
  label: string
  description: string
  maleFocus: string
  femaleFocus: string
  resolveScore: (vector: FinalPersonalityVector) => number
}

const DIMENSION_RULES: DimensionRule[] = [
  {
    key: "exploration",
    label: "探索性",
    description: "好奇、外出、尝试新环境、主动接触未知。",
    maleFocus: "更关注主动开拓、扩大范围、冒险与推进外部目标。",
    femaleFocus: "更关注环境适应、选择性探索、敏锐判断与安全边界。",
    resolveScore: (vector) => average([
      vector.curiosity,
      vector.explorationDrive,
      vector.activity,
      vector.adaptability,
    ]),
  },
  {
    key: "attachment",
    label: "依附性",
    description: "亲密、陪伴、关系绑定、安全连接。",
    maleFocus: "更关注保护关系、结盟、共同目标与承担陪伴。",
    femaleFocus: "更关注情感连接、归属、安全回应与关系稳定。",
    resolveScore: (vector) => average([
      vector.attachment,
      vector.stability,
      vector.sensitivity,
      vector.restPreference,
    ]),
  },
  {
    key: "stability",
    label: "稳定性",
    description: "规律、恢复、休息、安全区、情绪平稳。",
    maleFocus: "更关注规则、秩序、安全区与边界维护。",
    femaleFocus: "更关注安稳、舒适、情绪平衡与细腻恢复。",
    resolveScore: (vector) => average([
      vector.stability,
      vector.restPreference,
      vector.persistence,
      vector.discipline,
    ]),
  },
  {
    key: "execution",
    label: "执行性",
    description: "目标、边界、推进、完成任务、掌控感。",
    maleFocus: "更关注责任、竞争、推进、掌控与完成任务。",
    femaleFocus: "更关注组织、协调、资源管理与稳定完成。",
    resolveScore: (vector) => average([
      vector.discipline,
      vector.control,
      vector.persistence,
      vector.reactionSpeed,
    ]),
  },
  {
    key: "caregiving",
    label: "照护性",
    description: "保护、照看、创造、延续、关心弱小对象。",
    maleFocus: "更关注保护、教导、承担、传承与解决问题。",
    femaleFocus: "更关注陪伴、滋养、安抚、感知需求与维持稳定。",
    resolveScore: (vector) => average([
      vector.attachment,
      vector.sensitivity,
      vector.stability,
      vector.sensoryDepth,
    ]),
  },
]

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function average(values: number[]): number {
  if (values.length === 0) return 50
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function resolveLevel(score: number): GenderPersonalityDimensionView["level"] {
  if (score >= 72) return "high"
  if (score >= 58) return "medium_high"
  if (score >= 43) return "medium"
  if (score >= 28) return "medium_low"
  return "low"
}

function buildDimensionSummary(input: {
  label: string
  score: number
  viewpoint: GenderInterpretationViewpoint
  focus: string
}): string {
  const levelText: Record<GenderPersonalityDimensionView["level"], string> = {
    high: "很强",
    medium_high: "偏强",
    medium: "中等",
    medium_low: "偏弱",
    low: "较弱",
  }

  const level = resolveLevel(input.score)
  const viewpointText = input.viewpoint === "male" ? "男命视角" : "女命视角"

  return `${input.label}${levelText[level]}。${viewpointText}下，${input.focus}`
}

function buildDimensionView(
  rule: DimensionRule,
  vector: FinalPersonalityVector,
  viewpoint: GenderInterpretationViewpoint
): GenderPersonalityDimensionView {
  const score = clampScore(rule.resolveScore(vector))
  const focus = viewpoint === "male" ? rule.maleFocus : rule.femaleFocus

  return {
    key: rule.key,
    label: rule.label,
    score,
    level: resolveLevel(score),
    description: rule.description,
    viewpointFocus: focus,
    summary: buildDimensionSummary({
      label: rule.label,
      score,
      viewpoint,
      focus,
    }),
  }
}

function buildOverallSummary(input: {
  viewpoint: GenderInterpretationViewpoint
  dimensions: GenderPersonalityDimensionView[]
}): string {
  const topDimensions = [...input.dimensions]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((dimension) => dimension.label)
    .join("、")

  const viewpointText = input.viewpoint === "male" ? "男命视角" : "女命视角"

  return `当前采用${viewpointText}解释同一套先天人格结构。核心强项集中在${topDimensions}，性格强弱仍由紫微结构与八字动力决定，性别只影响解释视角，不改变底层人格分数。`
}

export function buildGenderPersonalityInterpretation(input: {
  vector: FinalPersonalityVector
  viewpoint: GenderInterpretationViewpoint
}): GenderPersonalityInterpretation {
  const dimensions = DIMENSION_RULES.map((rule) =>
    buildDimensionView(rule, input.vector, input.viewpoint)
  )

  return {
    viewpoint: input.viewpoint,
    principle: "同盘同结构，男女异视角；紫微定结构，八字定动力，五维定表达。",
    dimensions,
    summary: buildOverallSummary({
      viewpoint: input.viewpoint,
      dimensions,
    }),
    debug: {
      doesModifyVector: false,
      note: "男女视角只影响解释文案与五维表达方式，不直接修改 FinalPersonalityVector 分数。",
    },
  }
}
