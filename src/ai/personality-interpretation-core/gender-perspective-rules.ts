/**
 * 当前文件负责：定义男命 / 女命视角如何解释同一套紫微结构。
 */

import type {
  GenderLifeFunctionFocus,
  GenderPerspective,
  GenderPerspectiveRule,
  ZiweiLifeFunctionKey,
} from "./interpretation-schema"

export const GENDER_PERSPECTIVE_RULES: Record<
  GenderPerspective,
  GenderPerspectiveRule
> = {
  male: {
    genderPerspective: "male",
    label: "男命视角",
    coreFocus: "行动、承担、推进、边界、外显责任",
    description:
      "男命视角更关注同一套紫微结构如何向外行动、承担责任、推进目标、建立边界和形成外显秩序。",
  },
  female: {
    genderPerspective: "female",
    label: "女命视角",
    coreFocus: "关系、感知、稳定、细腻、内在连接",
    description:
      "女命视角更关注同一套紫微结构如何在关系、感知、稳定、细腻表达和内在连接中呈现。",
  },
}

export const GENDER_LIFE_FUNCTION_FOCUS_RULES: Record<
  ZiweiLifeFunctionKey,
  GenderLifeFunctionFocus
> = {
  coreSelf: {
    functionKey: "coreSelf",
    maleFocus: "更关注行动、承担、推进与外显自我。",
    femaleFocus: "更关注感知、稳定、内在自我与情绪反应。",
  },
  taskExecution: {
    functionKey: "taskExecution",
    maleFocus: "更关注推进目标、建立规则、竞争完成与外部责任。",
    femaleFocus: "更关注稳定执行、资源管理、组织协调与持续完成。",
  },
  longTermBond: {
    functionKey: "longTermBond",
    maleFocus: "更关注伙伴、结盟、共同目标与保护关系。",
    femaleFocus: "更关注归属、依附、安全回应与关系确认。",
  },
  caregivingCreation: {
    functionKey: "caregivingCreation",
    maleFocus: "更关注教导、传承、保护、承担照护与解决问题。",
    femaleFocus: "更关注陪伴、滋养、安抚、感知需求与细腻照看。",
  },
  innerRecovery: {
    functionKey: "innerRecovery",
    maleFocus: "更关注精神满足、兴趣成就、主动放松与自我恢复。",
    femaleFocus: "更关注情绪平安、内在安全、稳定恢复与舒适感。",
  },
  explorationRange: {
    functionKey: "explorationRange",
    maleFocus: "更关注冒险、开拓、主动外出与扩大范围。",
    femaleFocus: "更关注适应、观察环境、选择性移动与安全边界。",
  },
  territorySafety: {
    functionKey: "territorySafety",
    maleFocus: "更关注守边界、扩建、保护领地与建立秩序。",
    femaleFocus: "更关注筑巢、安住、舒适、归属感与空间安全。",
  },
}

export function getGenderLifeFunctionFocus(input: {
  functionKey: ZiweiLifeFunctionKey
  genderPerspective: GenderPerspective
}): string {
  const focusRule = GENDER_LIFE_FUNCTION_FOCUS_RULES[input.functionKey]

  return input.genderPerspective === "male"
    ? focusRule.maleFocus
    : focusRule.femaleFocus
}