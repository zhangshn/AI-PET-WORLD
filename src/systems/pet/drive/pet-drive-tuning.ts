/**
 * 当前文件负责：集中管理宠物 drive 系统的调参参数。
 */

import type {
  LifeTendencyKey,
} from "../../../ai/gateway"

import type {
  StimulusInterpretation,
  StimulusReactionTendency,
} from "../../../types/cognition"

import type {
  DriveType,
} from "./pet-drive-types"

export type LifeTendencyDriveTuningItem = {
  drive: DriveType
  tendencyKey: LifeTendencyKey
  maxBonus: number
  reason: string
}

export type CognitionReactionDriveTuningItem = Partial<Record<
  DriveType,
  {
    base: number
    levelField?: "curiosityLevel" | "stressLevel" | "safetyFeeling"
    levelFactor?: number
    reason: string
  }
>>

export type CognitionInterpretationDriveTuningItem = Partial<Record<
  DriveType,
  {
    base: number
    reason: string
  }
>>

export const LIFE_TENDENCY_DRIVE_TUNING: LifeTendencyDriveTuningItem[] = [
  {
    drive: "explore",
    tendencyKey: "explore",
    maxBonus: 6,
    reason: "生命趋向：探索趋向",
  },
  {
    drive: "observe",
    tendencyKey: "observe",
    maxBonus: 5,
    reason: "生命趋向：观察趋向",
  },
  {
    drive: "approach",
    tendencyKey: "approach",
    maxBonus: 4,
    reason: "生命趋向：靠近趋向",
  },
  {
    drive: "rest",
    tendencyKey: "recover",
    maxBonus: 4,
    reason: "生命趋向：恢复趋向",
  },
  {
    drive: "observe",
    tendencyKey: "routine",
    maxBonus: 2,
    reason: "生命趋向：秩序趋向提高稳定观察",
  },
]

export const LIFE_TENDENCY_ACTION_INTENSITY_TUNING = {
  maxBonus: 3,
  exploreRatio: 0.6,
  approachRatio: 0.4,
}

export const LIFE_TENDENCY_PERCEPTION_TUNING = {
  maxBonus: 3,
}

export const LIFE_TENDENCY_BOUNDARY_TUNING = {
  boundaryMaxBonus: 2,
  protectMaxBonus: 2,
}

export const LIFE_TENDENCY_CARE_TUNING = {
  maxBonus: 2,
}

export const COGNITION_REACTION_DRIVE_TUNING: Record<
  StimulusReactionTendency,
  CognitionReactionDriveTuningItem
> = {
  chase: {
    explore: {
      base: 8,
      levelField: "curiosityLevel",
      levelFactor: 0.08,
      reason: "认知驱动：追随倾向提高探索 drive",
    },
    observe: {
      base: 4,
      reason: "认知驱动：追随前仍需要观察目标变化",
    },
  },

  observe: {
    observe: {
      base: 10,
      levelField: "curiosityLevel",
      levelFactor: 0.05,
      reason: "认知驱动：观察倾向提高 observe drive",
    },
  },

  approach: {
    approach: {
      base: 8,
      levelField: "safetyFeeling",
      levelFactor: 0.04,
      reason: "认知驱动：安全靠近倾向提高 approach drive",
    },
  },

  avoid: {
    avoid: {
      base: 10,
      levelField: "stressLevel",
      levelFactor: 0.08,
      reason: "认知驱动：回避倾向提高 avoid drive",
    },
    observe: {
      base: 4,
      reason: "认知驱动：回避前先确认边界",
    },
  },

  ignore: {},

  rest_nearby: {
    rest: {
      base: 9,
      levelField: "safetyFeeling",
      levelFactor: 0.04,
      reason: "认知驱动：附近恢复倾向提高 rest drive",
    },
    observe: {
      base: 3,
      reason: "认知驱动：恢复前保留轻度观察",
    },
  },
}

export const COGNITION_INTERPRETATION_DRIVE_TUNING: Record<
  StimulusInterpretation,
  CognitionInterpretationDriveTuningItem
> = {
  safe: {},
  ignore: {},

  exciting: {
    explore: {
      base: 5,
      reason: "认知解释：兴奋刺激提高探索 drive",
    },
  },

  interesting: {
    observe: {
      base: 5,
      reason: "认知解释：未知 / 有趣刺激提高观察 drive",
    },
  },

  mysterious: {
    observe: {
      base: 5,
      reason: "认知解释：未知 / 有趣刺激提高观察 drive",
    },
  },

  comforting: {
    rest: {
      base: 5,
      reason: "认知解释：舒适刺激提高恢复 drive",
    },
  },

  peaceful: {
    rest: {
      base: 5,
      reason: "认知解释：舒适刺激提高恢复 drive",
    },
  },

  annoying: {
    avoid: {
      base: 4,
      reason: "认知解释：干扰刺激提高回避 drive",
    },
  },

  dangerous: {
    avoid: {
      base: 8,
      reason: "认知解释：危险刺激提高回避 drive",
    },
  },
}

export const DRIVE_TUNING_NOTES = {
  lifeTendency:
    "生命趋向只做底层偏移，不直接决定 action，也不能覆盖饥饿、疲劳等生理优先级。",
  cognition:
    "认知只影响 drive；世界刺激不能直接推行为，只能先转成主体内部驱动变化。",
}