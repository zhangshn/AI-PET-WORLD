/**
 * 当前文件负责：集中管理宠物 goal 系统的调参参数。
 */

import type {
  LifeTendencyKey,
} from "../../../ai/gateway"

import type {
  DriveType,
} from "../pet-drive/pet-drive-gateway"

import type {
  PetGoalType,
} from "./pet-goal-runner"

export type GoalLifeTendencyCandidateTuning = {
  type: PetGoalType
  keys: LifeTendencyKey[]
  minimumScore: number
  priorityBoostScore: number
  summary: string
}

export type GoalDriveAlignmentRule = {
  from: PetGoalType
  drive: DriveType
  to: PetGoalType
  minimumDominantScore: number
  summary: string
}

export const GOAL_LIFE_TENDENCY_SUMMARY_MARKERS = [
  " 生命趋向提示：",
  " 生命趋向补充：",
]

export const GOAL_LIFE_TENDENCY_CANDIDATE_TUNING: GoalLifeTendencyCandidateTuning[] = [
  {
    type: "expand_territory",
    keys: ["explore", "action"],
    minimumScore: 58,
    priorityBoostScore: 72,
    summary:
      "当前生命趋向对外部变化与探索表达更敏感，因此目标解释偏向试探新边界。",
  },
  {
    type: "observe_boundary",
    keys: ["observe", "perception"],
    minimumScore: 58,
    priorityBoostScore: 72,
    summary:
      "当前生命趋向强化观察与信息辨认，因此目标解释偏向先理解环境。",
  },
  {
    type: "restore_self",
    keys: ["recover"],
    minimumScore: 58,
    priorityBoostScore: 72,
    summary:
      "当前生命趋向提示恢复需求较明显，因此目标解释偏向回收自身与稳定状态。",
  },
  {
    type: "secure_attachment",
    keys: ["approach", "care"],
    minimumScore: 58,
    priorityBoostScore: 72,
    summary:
      "当前生命趋向对连接与照护更敏感，因此目标解释偏向确认关系锚点。",
  },
  {
    type: "preserve_distance",
    keys: ["boundary", "protect"],
    minimumScore: 58,
    priorityBoostScore: 72,
    summary:
      "当前生命趋向强化边界与保护，因此目标解释偏向维持安全距离。",
  },
  {
    type: "stabilize_state",
    keys: ["routine"],
    minimumScore: 58,
    priorityBoostScore: 72,
    summary:
      "当前生命趋向偏向秩序与节律，因此目标解释偏向维持稳定状态。",
  },
]

export const GOAL_LIFE_TENDENCY_ATTACH_RULES: Partial<Record<
  PetGoalType,
  PetGoalType[]
>> = {
  idle_drift: [
    "observe_boundary",
    "stabilize_state",
  ],
  restore_self: [
    "stabilize_state",
  ],
  observe_boundary: [
    "preserve_distance",
  ],
  expand_territory: [
    "observe_boundary",
  ],
}

export const GOAL_DRIVE_ALIGNMENT_TUNING = {
  defaultMinimumDominantScore: 38,
  idleDriftMinimumDominantScore: 45,
}

export const GOAL_DRIVE_ALIGNMENT_RULES: GoalDriveAlignmentRule[] = [
  {
    from: "expand_territory",
    drive: "observe",
    to: "observe_boundary",
    minimumDominantScore: 38,
    summary:
      "当前主导 drive 偏向观察，外扩目标被轻量校正为先观察边界。",
  },
  {
    from: "expand_territory",
    drive: "avoid",
    to: "preserve_distance",
    minimumDominantScore: 38,
    summary:
      "当前主导 drive 偏向回避，外扩目标被轻量校正为先保持边界。",
  },
  {
    from: "secure_attachment",
    drive: "observe",
    to: "observe_boundary",
    minimumDominantScore: 38,
    summary:
      "当前主导 drive 偏向观察，关系靠近目标被轻量校正为先确认安全。",
  },
]

export const GOAL_DRIVE_TO_GOAL_TYPE: Record<
  DriveType,
  PetGoalType
> = {
  eat: "satisfy_need",
  rest: "restore_self",
  avoid: "preserve_distance",
  approach: "secure_attachment",
  explore: "expand_territory",
  observe: "observe_boundary",
}

export const GOAL_TUNING_NOTES = {
  lifeTendency:
    "生命趋向只修饰 goal 解释与轻量优先级，不直接决定 action。",
  driveAlignment:
    "drive alignment 只在 goal 与当前主导 drive 明显错位时轻量校正，不覆盖 critical / body 生理目标。",
}