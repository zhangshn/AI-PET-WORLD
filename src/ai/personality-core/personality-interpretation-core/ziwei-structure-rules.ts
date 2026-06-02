/**
 * 当前文件负责：定义紫微结构到现代生命功能的主规则。
 */

import type { SectorName } from "../../destiny-core/ziwei-core/ziwei-core-schema"

import type {
  ZiweiLifeFunctionKey,
  ZiweiLifeFunctionRule,
} from "./interpretation-schema"

export const ZIWEI_LIFE_FUNCTION_ORDER: ZiweiLifeFunctionKey[] = [
  "coreSelf",
  "taskExecution",
  "longTermBond",
  "caregivingCreation",
  "innerRecovery",
  "explorationRange",
  "territorySafety",
]

export const ZIWEI_SECTOR_TO_LIFE_FUNCTION: Partial<
  Record<SectorName, ZiweiLifeFunctionKey>
> = {
  life: "coreSelf",
  career: "taskExecution",
  spouse: "longTermBond",
  children: "caregivingCreation",
  fortune: "innerRecovery",
  travel: "explorationRange",
  property: "territorySafety",
}

export const ZIWEI_LIFE_FUNCTION_RULES: Record<
  ZiweiLifeFunctionKey,
  ZiweiLifeFunctionRule
> = {
  coreSelf: {
    key: "coreSelf",
    label: "核心自我",
    sourceSector: "life",
    baseMeaning: "生命最核心的自我反应方式、主驱动力与存在感。",
    relatedTraits: [
      "activity",
      "curiosity",
      "discipline",
      "stability",
      "emotionalSensitivity",
    ],
  },
  taskExecution: {
    key: "taskExecution",
    label: "任务执行",
    sourceSector: "career",
    baseMeaning: "面对目标、责任、秩序、规则和长期任务时的推进方式。",
    relatedTraits: [
      "discipline",
      "activity",
      "stability",
      "buildingPreference",
    ],
  },
  longTermBond: {
    key: "longTermBond",
    label: "长期绑定",
    sourceSector: "spouse",
    baseMeaning: "长期关系、亲密连接、信任模式和稳定陪伴的形成方式。",
    relatedTraits: [
      "stability",
      "emotionalSensitivity",
      "caregiving",
      "restPreference",
    ],
  },
  caregivingCreation: {
    key: "caregivingCreation",
    label: "照护创造",
    sourceSector: "children",
    baseMeaning: "照看、保护、创造、延续与关心弱小对象的倾向。",
    relatedTraits: [
      "caregiving",
      "emotionalSensitivity",
      "stability",
      "activity",
    ],
  },
  innerRecovery: {
    key: "innerRecovery",
    label: "内在恢复",
    sourceSector: "fortune",
    baseMeaning: "内心恢复、情绪自洽、休息偏好和精神安放方式。",
    relatedTraits: [
      "restPreference",
      "stability",
      "emotionalSensitivity",
      "appetite",
    ],
  },
  explorationRange: {
    key: "explorationRange",
    label: "探索半径",
    sourceSector: "travel",
    baseMeaning: "外部环境适应、探索范围、刺激反应和移动倾向。",
    relatedTraits: [
      "curiosity",
      "activity",
      "stability",
      "discipline",
    ],
  },
  territorySafety: {
    key: "territorySafety",
    label: "领地安全",
    sourceSector: "property",
    baseMeaning: "空间归属、安全区、边界感和长期安住倾向。",
    relatedTraits: [
      "stability",
      "buildingPreference",
      "discipline",
      "restPreference",
    ],
  },
}