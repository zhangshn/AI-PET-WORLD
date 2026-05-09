/**
 * 当前文件负责：定义男命 / 女命视角进入紫微结构映射前的规则。
 */

import type {
  GenderLifeFunctionFocus,
  GenderPerspective,
  GenderPerspectiveRule,
  ZiweiLifeFunctionKey,
} from "./interpretation-schema"

export type GenderTraitWeights = Record<string, number>

export type GenderAwareZiweiMappingRule = {
  functionKey: ZiweiLifeFunctionKey
  maleTraitWeights: GenderTraitWeights
  femaleTraitWeights: GenderTraitWeights
}

export const GENDER_PERSPECTIVE_RULES: Record<
  GenderPerspective,
  GenderPerspectiveRule
> = {
  male: {
    genderPerspective: "male",
    label: "男命视角",
    coreFocus: "行动、承担、推进、边界、外显责任",
    description:
      "男命视角会先进入人格映射阶段，使同一套紫微结构优先转译为行动、承担、推进、边界和外显责任。",
  },
  female: {
    genderPerspective: "female",
    label: "女命视角",
    coreFocus: "关系、感知、稳定、细腻、内在连接",
    description:
      "女命视角会先进入人格映射阶段，使同一套紫微结构优先转译为关系、感知、稳定、细腻表达和内在连接。",
  },
}

export const GENDER_LIFE_FUNCTION_FOCUS_RULES: Record<
  ZiweiLifeFunctionKey,
  GenderLifeFunctionFocus
> = {
  coreSelf: {
    functionKey: "coreSelf",
    maleFocus: "更关注行动、承担、推进、外显自我与主导反应。",
    femaleFocus: "更关注感知、稳定、内在自我、情绪反应与关系位置。",
  },
  taskExecution: {
    functionKey: "taskExecution",
    maleFocus: "更关注推进目标、建立规则、竞争完成与外部责任。",
    femaleFocus: "更关注稳定执行、资源管理、组织协调与持续完成。",
  },
  longTermBond: {
    functionKey: "longTermBond",
    maleFocus: "更关注伙伴、结盟、共同目标、保护关系与责任绑定。",
    femaleFocus: "更关注归属、依附、安全回应、关系确认与情绪稳定。",
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
    maleFocus: "更关注冒险、开拓、主动外出、扩大范围与外部推进。",
    femaleFocus: "更关注适应、观察环境、选择性移动、安全边界与敏锐判断。",
  },
  territorySafety: {
    functionKey: "territorySafety",
    maleFocus: "更关注守边界、扩建、保护领地、建立秩序与外部稳定。",
    femaleFocus: "更关注筑巢、安住、舒适、归属感、空间安全与内部稳定。",
  },
}

export const GENDER_AWARE_ZIWEI_MAPPING_RULES: Record<
  ZiweiLifeFunctionKey,
  GenderAwareZiweiMappingRule
> = {
  coreSelf: {
    functionKey: "coreSelf",
    maleTraitWeights: {
      activity: 0.28,
      discipline: 0.22,
      confidence: 0.2,
      curiosity: 0.16,
      stability: 0.14,
    },
    femaleTraitWeights: {
      emotionalSensitivity: 0.26,
      sensitivity: 0.18,
      stability: 0.2,
      caregiving: 0.16,
      restPreference: 0.12,
      curiosity: 0.08,
    },
  },
  taskExecution: {
    functionKey: "taskExecution",
    maleTraitWeights: {
      discipline: 0.32,
      activity: 0.22,
      confidence: 0.18,
      buildingPreference: 0.16,
      stability: 0.12,
    },
    femaleTraitWeights: {
      discipline: 0.26,
      stability: 0.22,
      buildingPreference: 0.2,
      emotionalSensitivity: 0.12,
      caregiving: 0.12,
      restPreference: 0.08,
    },
  },
  longTermBond: {
    functionKey: "longTermBond",
    maleTraitWeights: {
      stability: 0.24,
      discipline: 0.2,
      caregiving: 0.18,
      confidence: 0.14,
      emotionalSensitivity: 0.12,
      restPreference: 0.12,
    },
    femaleTraitWeights: {
      emotionalSensitivity: 0.26,
      caregiving: 0.22,
      stability: 0.2,
      restPreference: 0.16,
      sensitivity: 0.1,
      dependency: 0.06,
    },
  },
  caregivingCreation: {
    functionKey: "caregivingCreation",
    maleTraitWeights: {
      caregiving: 0.26,
      discipline: 0.2,
      activity: 0.18,
      stability: 0.16,
      confidence: 0.1,
      buildingPreference: 0.1,
    },
    femaleTraitWeights: {
      caregiving: 0.3,
      emotionalSensitivity: 0.22,
      stability: 0.18,
      restPreference: 0.12,
      sensitivity: 0.1,
      buildingPreference: 0.08,
    },
  },
  innerRecovery: {
    functionKey: "innerRecovery",
    maleTraitWeights: {
      restPreference: 0.24,
      stability: 0.22,
      discipline: 0.18,
      confidence: 0.14,
      curiosity: 0.12,
      emotionalSensitivity: 0.1,
    },
    femaleTraitWeights: {
      restPreference: 0.28,
      emotionalSensitivity: 0.22,
      stability: 0.22,
      sensitivity: 0.14,
      caregiving: 0.08,
      appetite: 0.06,
    },
  },
  explorationRange: {
    functionKey: "explorationRange",
    maleTraitWeights: {
      activity: 0.3,
      curiosity: 0.26,
      confidence: 0.16,
      discipline: 0.12,
      stability: 0.08,
      buildingPreference: 0.08,
    },
    femaleTraitWeights: {
      curiosity: 0.24,
      emotionalSensitivity: 0.22,
      sensitivity: 0.16,
      stability: 0.14,
      activity: 0.12,
      restPreference: 0.12,
    },
  },
  territorySafety: {
    functionKey: "territorySafety",
    maleTraitWeights: {
      stability: 0.26,
      discipline: 0.24,
      buildingPreference: 0.2,
      confidence: 0.12,
      restPreference: 0.1,
      activity: 0.08,
    },
    femaleTraitWeights: {
      stability: 0.28,
      restPreference: 0.22,
      buildingPreference: 0.18,
      emotionalSensitivity: 0.14,
      caregiving: 0.1,
      sensitivity: 0.08,
    },
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

export function getGenderAwareZiweiTraitWeights(input: {
  functionKey: ZiweiLifeFunctionKey
  genderPerspective: GenderPerspective
}): GenderTraitWeights {
  const rule = GENDER_AWARE_ZIWEI_MAPPING_RULES[input.functionKey]

  return input.genderPerspective === "male"
    ? rule.maleTraitWeights
    : rule.femaleTraitWeights
}