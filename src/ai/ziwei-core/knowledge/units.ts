/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Core - Knowledge / Units
 *
 * 功能：
 * 定义基础单元知识
 * ======================================================
 */

import { PersonalityTraits } from "../schema"

export type UnitGroupType =
  | "group_a"
  | "group_b"
  | "group_c"
  | "group_d"

export type TraitWeights = Partial<PersonalityTraits>

export type UnitKnowledge = {
  unitId: string
  groupType: UnitGroupType
  displayKey: string
  coreLabel: string
  baseTraits: TraitWeights
  summaryTags: string[]
}

/**
 * 当前先给第一版基础单元知识表
 */
export const UNIT_KNOWLEDGE_MAP: Record<string, UnitKnowledge> = {
  unit_01: {
    unitId: "unit_01",
    groupType: "group_b",
    displayKey: "label_unit_01",
    coreLabel: "稳重掌控型",
    baseTraits: {
      stability: 16,
      discipline: 12,
      caregiving: 10
    },
    summaryTags: ["领导感", "稳重", "有掌控欲"]
  },

  unit_02: {
    unitId: "unit_02",
    groupType: "group_a",
    displayKey: "label_unit_02",
    coreLabel: "欲望行动型",
    baseTraits: {
      activity: 16,
      appetite: 14,
      curiosity: 12,
      restPreference: -6
    },
    summaryTags: ["好动", "欲望强", "爱尝试"]
  },

  unit_03: {
    unitId: "unit_03",
    groupType: "group_c",
    displayKey: "label_unit_03",
    coreLabel: "思辨敏感型",
    baseTraits: {
      curiosity: 12,
      emotionalSensitivity: 12,
      stability: -4
    },
    summaryTags: ["善分析", "多思", "易疑虑"]
  },

  unit_04: {
    unitId: "unit_04",
    groupType: "group_a",
    displayKey: "label_unit_04",
    coreLabel: "锋芒自持型",
    baseTraits: {
      activity: 10,
      discipline: 8,
      emotionalSensitivity: 8
    },
    summaryTags: ["主观强", "锋芒感", "自我要求"]
  },

  unit_05: {
    unitId: "unit_05",
    groupType: "group_b",
    displayKey: "label_unit_05",
    coreLabel: "务实执行型",
    baseTraits: {
      discipline: 16,
      buildingPreference: 14,
      stability: 10
    },
    summaryTags: ["务实", "执行力强", "重秩序"]
  },

  unit_06: {
    unitId: "unit_06",
    groupType: "group_a",
    displayKey: "label_unit_06",
    coreLabel: "破立变化型",
    baseTraits: {
      activity: 14,
      curiosity: 10,
      emotionalSensitivity: 8,
      stability: -12
    },
    summaryTags: ["变动强", "突破", "不喜拘束"]
  },

  unit_07: {
    unitId: "unit_07",
    groupType: "group_b",
    displayKey: "label_unit_07",
    coreLabel: "稳守资源型",
    baseTraits: {
      stability: 16,
      caregiving: 12,
      buildingPreference: 10,
      restPreference: 4
    },
    summaryTags: ["稳重", "能守", "重安全感"]
  },

  unit_08: {
    unitId: "unit_08",
    groupType: "group_c",
    displayKey: "label_unit_08",
    coreLabel: "聪敏策划型",
    baseTraits: {
      curiosity: 16,
      activity: 8,
      discipline: 6
    },
    summaryTags: ["聪明", "善分析", "思虑较多"]
  },

  unit_09: {
    unitId: "unit_09",
    groupType: "group_b",
    displayKey: "label_unit_09",
    coreLabel: "规则协调整型",
    baseTraits: {
      caregiving: 14,
      stability: 10,
      discipline: 8
    },
    summaryTags: ["体面", "原则性", "有配合意识"]
  },

  unit_10: {
    unitId: "unit_10",
    groupType: "group_d",
    displayKey: "label_unit_10",
    coreLabel: "慈护安定型",
    baseTraits: {
      caregiving: 16,
      stability: 12,
      restPreference: 6
    },
    summaryTags: ["慈悲", "庇护感", "偏安定"]
  },

  unit_11: {
    unitId: "unit_11",
    groupType: "group_d",
    displayKey: "label_unit_11",
    coreLabel: "温和安逸型",
    baseTraits: {
      restPreference: 16,
      appetite: 8,
      emotionalSensitivity: 10,
      activity: -4
    },
    summaryTags: ["温和", "知足", "偏安逸"]
  },

  unit_12: {
    unitId: "unit_12",
    groupType: "group_a",
    displayKey: "label_unit_12",
    coreLabel: "刚决推进型",
    baseTraits: {
      activity: 14,
      discipline: 6,
      emotionalSensitivity: 10,
      stability: -10
    },
    summaryTags: ["冲劲强", "果断", "波动感明显"]
  },

  unit_13: {
    unitId: "unit_13",
    groupType: "group_c",
    displayKey: "label_unit_13",
    coreLabel: "外放热心型",
    baseTraits: {
      activity: 14,
      curiosity: 10,
      stability: 6
    },
    summaryTags: ["外放", "热心", "表达欲较强"]
  },

  unit_14: {
    unitId: "unit_14",
    groupType: "group_d",
    displayKey: "label_unit_14",
    coreLabel: "安静细腻型",
    baseTraits: {
      restPreference: 16,
      emotionalSensitivity: 14,
      stability: 6,
      activity: -6
    },
    summaryTags: ["安静", "敏感", "偏柔和"]
  }
}

export function getUnitKnowledge(unitId: string): UnitKnowledge | undefined {
  return UNIT_KNOWLEDGE_MAP[unitId]
}