/**
 * 当前文件负责：定义宠物 drive 系统的核心类型。
 */

import type { TimeState } from "../../../engine/timeSystem"
import type { PetState } from "../../../types/pet"
import type { PetMemoryState } from "../../../ai/memory-core/memory-gateway"

export type DriveType =
  | "eat"
  | "rest"
  | "avoid"
  | "approach"
  | "explore"
  | "observe"

export type DriveScores = Record<DriveType, number>

export type DriveSnapshot = {
  values: DriveScores
  dominant: DriveType
  dominantScore: number
  reasons: Record<DriveType, string[]>
  summary: string
}

export type DriveSystemPetInput = Pick<
  PetState,
  | "energy"
  | "hunger"
  | "mood"
  | "timelineSnapshot"
  | "personalityProfile"
  | "consciousnessProfile"
> & {
  memoryState?: PetMemoryState | null
}

export type DriveSystemInput = {
  pet: DriveSystemPetInput
  time: TimeState
  externalStimuli?: Partial<Record<DriveType, number>>
}

export type DriveLayerContext = {
  input: DriveSystemInput
  scores: DriveScores
  reasons: Record<DriveType, string[]>
}