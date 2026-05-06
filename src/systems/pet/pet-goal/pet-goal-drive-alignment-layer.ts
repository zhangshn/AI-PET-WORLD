/**
 * 当前文件负责：根据当前主导 drive 轻量校正宠物 goal 解释。
 */

import type {
  DriveSnapshot,
  DriveType,
} from "../pet-drive/pet-drive-gateway"

import type {
  PetGoalState,
  PetGoalType,
} from "./pet-goal-runner"

export type PetGoalDriveAlignment = {
  dominantDrive: DriveType
  originalType: PetGoalType
  alignedType: PetGoalType
  summary: string
  changed: boolean
}

function mapDriveToGoalType(drive: DriveType): PetGoalType {
  switch (drive) {
    case "eat":
      return "satisfy_need"
    case "rest":
      return "restore_self"
    case "avoid":
      return "preserve_distance"
    case "approach":
      return "secure_attachment"
    case "explore":
      return "expand_territory"
    case "observe":
      return "observe_boundary"
  }
}

function shouldAlignGoal(params: {
  goal: Omit<PetGoalState, "startedAtTick" | "holdUntilTick">
  driveSnapshot: DriveSnapshot
}): boolean {
  const dominantDrive = params.driveSnapshot.dominant
  const dominantScore = params.driveSnapshot.dominantScore

  if (dominantScore < 38) {
    return false
  }

  if (params.goal.priority === "critical") {
    return false
  }

  if (
    params.goal.source === "body" &&
    (
      params.goal.type === "restore_self" ||
      params.goal.type === "satisfy_need"
    )
  ) {
    return false
  }

  if (
    params.goal.type === "expand_territory" &&
    dominantDrive === "observe"
  ) {
    return true
  }

  if (
    params.goal.type === "expand_territory" &&
    dominantDrive === "avoid"
  ) {
    return true
  }

  if (
    params.goal.type === "secure_attachment" &&
    dominantDrive === "observe"
  ) {
    return true
  }

  if (
    params.goal.type === "idle_drift" &&
    dominantScore >= 45
  ) {
    return true
  }

  return false
}

function buildAlignmentSummary(params: {
  dominantDrive: DriveType
  originalType: PetGoalType
  alignedType: PetGoalType
}): string {
  if (
    params.originalType === "expand_territory" &&
    params.alignedType === "observe_boundary"
  ) {
    return "当前主导 drive 偏向观察，外扩目标被轻量校正为先观察边界。"
  }

  if (
    params.originalType === "expand_territory" &&
    params.alignedType === "preserve_distance"
  ) {
    return "当前主导 drive 偏向回避，外扩目标被轻量校正为先保持边界。"
  }

  if (
    params.originalType === "secure_attachment" &&
    params.alignedType === "observe_boundary"
  ) {
    return "当前主导 drive 偏向观察，关系靠近目标被轻量校正为先确认安全。"
  }

  if (params.originalType === "idle_drift") {
    return "当前主导 drive 已经变得明确，弱目标被轻量校正为更清晰的目标方向。"
  }

  return `当前主导 drive 为 ${params.dominantDrive}，goal 获得轻量校正。`
}

export function applyGoalDriveAlignmentLayer(params: {
  goal: Omit<PetGoalState, "startedAtTick" | "holdUntilTick">
  driveSnapshot?: DriveSnapshot | null
}): Omit<PetGoalState, "startedAtTick" | "holdUntilTick"> {
  if (!params.driveSnapshot) {
    return {
      ...params.goal,
      driveAlignment: null,
    }
  }

  if (
    !shouldAlignGoal({
      goal: params.goal,
      driveSnapshot: params.driveSnapshot,
    })
  ) {
    return {
      ...params.goal,
      driveAlignment: {
        dominantDrive: params.driveSnapshot.dominant,
        originalType: params.goal.type,
        alignedType: params.goal.type,
        summary: "当前 goal 与主导 drive 暂不需要校正。",
        changed: false,
      },
    }
  }

  const alignedType = mapDriveToGoalType(params.driveSnapshot.dominant)

  const summary = buildAlignmentSummary({
    dominantDrive: params.driveSnapshot.dominant,
    originalType: params.goal.type,
    alignedType,
  })

  return {
    ...params.goal,
    type: alignedType,
    summary: `${params.goal.summary} drive 校正：${summary}`,
    driveAlignment: {
      dominantDrive: params.driveSnapshot.dominant,
      originalType: params.goal.type,
      alignedType,
      summary,
      changed: alignedType !== params.goal.type,
    },
  }
}