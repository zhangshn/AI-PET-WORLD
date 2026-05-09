/**
 * 当前文件负责：定义管家任务选择过程的审计结构。
 */

import type { ButlerTask } from "../butler-schema"
import type { ButlerProfileTaskTuning } from "../butler-profile-tuning"
import type { ButlerExperienceInterpretation } from "../memory-relation/butler-relation-tuning"

export type ButlerTaskDecisionGate = {
  key: string
  passed: boolean
  reason: string
}

export type ButlerTaskDecisionScore = {
  key: string
  value: number
  reason: string
}

export type ButlerTaskDecisionTrace = {
  selectedTask: ButlerTask
  previousTask: ButlerTask
  reason: string
  gates: ButlerTaskDecisionGate[]
  scores: ButlerTaskDecisionScore[]
  profileTuning: ButlerProfileTaskTuning
  experienceInterpretation: ButlerExperienceInterpretation | null
  context: {
    hasPet: boolean
    hasTimelineSnapshot: boolean
    incubatorCompleted: boolean
    homeCompleted: boolean
    pendingOpportunityCount: number
    petEnergy: number | null
    petHunger: number | null
    petEmotion: string | null
    petRelation: string | null
    petLifePhase: string | null
    timeHour: number
    timePeriod?: string
  }
}

export function buildButlerTaskDecisionTrace(input: {
  selectedTask: ButlerTask
  previousTask: ButlerTask
  reason: string
  gates: ButlerTaskDecisionGate[]
  scores: ButlerTaskDecisionScore[]
  profileTuning: ButlerProfileTaskTuning
  experienceInterpretation?: ButlerExperienceInterpretation | null
  context: ButlerTaskDecisionTrace["context"]
}): ButlerTaskDecisionTrace {
  return {
    selectedTask: input.selectedTask,
    previousTask: input.previousTask,
    reason: input.reason,
    gates: input.gates,
    scores: input.scores,
    profileTuning: input.profileTuning,
    experienceInterpretation: input.experienceInterpretation ?? null,
    context: input.context,
  }
}
