/**
 * 当前文件负责：定义宠物目标系统的核心类型。
 */

import type { TimeState } from "../../../engine/timeSystem"
import type { PetState } from "../../../types/pet"
import type { WorldZone, WorldZoneType } from "../../../world/ecology/world-zone-types"

import type {
  DriveSnapshot,
  DriveType,
} from "../drive/pet-drive-gateway"

export type PetGoalType =
  | "expand_territory"
  | "observe_boundary"
  | "restore_self"
  | "satisfy_need"
  | "secure_attachment"
  | "preserve_distance"
  | "stabilize_state"
  | "idle_drift"

export type GoalPriority = "low" | "medium" | "high" | "critical"

export type PetGoalLifeTendencyHint = {
  targetType: PetGoalType
  summary: string
  priorityBoost: 0 | 1
  attached: boolean
}

export type PetGoalDriveAlignment = {
  dominantDrive: DriveType
  originalType: PetGoalType
  alignedType: PetGoalType
  summary: string
  changed: boolean
}

export type PetGoalState = {
  type: PetGoalType
  priority: GoalPriority
  startedAtTick: number
  holdUntilTick: number
  summary: string
  source: "consciousness" | "body" | "world" | "relation" | "memory"

  /**
   * 当前生命趋向对 goal 层的解释影响。
   * 这里只用于解释和轻量优先级修正，不直接决定 action。
   */
  lifeTendencyHint?: PetGoalLifeTendencyHint | null

  /**
   * 当前 drive 对 goal 层的轻量校正。
   * 这里只校正目标解释方向，不直接决定 action。
   */
  driveAlignment?: PetGoalDriveAlignment | null

  targetZoneType?: WorldZoneType
  targetZoneId?: string
  targetWorldPosition?: {
    x: number
    y: number
  }
}

export type GoalSystemInput = {
  tick: number
  pet: Pick<
    PetState,
    | "energy"
    | "hunger"
    | "mood"
    | "timelineSnapshot"
    | "consciousnessProfile"
    | "memoryState"
    | "currentLifeRuntimeBundle"
  >
  time: TimeState
  previousGoal?: PetGoalState | null
  driveSnapshot?: DriveSnapshot | null
  zones?: WorldZone[]
}

export type GoalDraft = Omit<
  PetGoalState,
  "startedAtTick" | "holdUntilTick"
>