/**
 * 当前文件负责：定义 Agent 运行时审计输入类型。
 */

import type {
  ButlerState,
} from "@/systems/butler/butler-schema"

import type {
  HomeState,
} from "@/types/home"

import type {
  PetState,
} from "@/types/pet"

export type RuntimePetAgentAuditInput = {
  tick: number
  petName: string

  rawAction: string
  expressedAction: string
  finalAction: string

  driveDominant: string
  driveDominantScore: number
  driveReasons: Record<string, string[]>

  goalType: string
  goalPriority: string
  goalSource: string
  goalSummary: string

  expressionReason: string
  expressionSummary: string
  stabilityReason: string

  energy: number
  hunger: number
  mood: string
  lifePhase: string

  hasCognitionInfluence: boolean
  hasLifeTendencyInfluence: boolean
  hasGoalLifeTendencyHint: boolean
  hasGoalDriveAlignment: boolean
}

export type RuntimeButlerAgentAuditInput = {
  tick: number
  butler: ButlerState
  pet: PetState | null
  home: HomeState | null
  time: {
    day: number
    hour: number
    period?: string
  }
}
