/**
 * 当前文件负责：根据当前主导 drive 轻量校正宠物 goal 解释。
 */

import type {
  DriveSnapshot,
} from "../pet-drive/pet-drive-gateway"

import type {
  PetGoalState,
  PetGoalType,
} from "./pet-goal-runner"

import {
  GOAL_DRIVE_ALIGNMENT_RULES,
  GOAL_DRIVE_ALIGNMENT_TUNING,
  GOAL_DRIVE_TO_GOAL_TYPE,
} from "./pet-goal-tuning"

function shouldSkipAlignment(goal: Omit<PetGoalState, "startedAtTick" | "holdUntilTick">): boolean {
  if (goal.priority === "critical") {
    return true
  }

  if (
    goal.source === "body" &&
    (
      goal.type === "restore_self" ||
      goal.type === "satisfy_need"
    )
  ) {
    return true
  }

  return false
}

function findAlignmentRule(params: {
  goalType: PetGoalType
  driveSnapshot: DriveSnapshot
}) {
  return GOAL_DRIVE_ALIGNMENT_RULES.find((rule) =>
    rule.from === params.goalType &&
    rule.drive === params.driveSnapshot.dominant &&
    params.driveSnapshot.dominantScore >= rule.minimumDominantScore
  )
}

function shouldAlignIdleDrift(driveSnapshot: DriveSnapshot): boolean {
  return (
    driveSnapshot.dominantScore >=
    GOAL_DRIVE_ALIGNMENT_TUNING.idleDriftMinimumDominantScore
  )
}

function buildNoChangeAlignment(params: {
  goal: Omit<PetGoalState, "startedAtTick" | "holdUntilTick">
  driveSnapshot: DriveSnapshot
}) {
  return {
    dominantDrive: params.driveSnapshot.dominant,
    originalType: params.goal.type,
    alignedType: params.goal.type,
    summary: "当前 goal 与主导 drive 暂不需要校正。",
    changed: false,
  }
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

  if (shouldSkipAlignment(params.goal)) {
    return {
      ...params.goal,
      driveAlignment: buildNoChangeAlignment({
        goal: params.goal,
        driveSnapshot: params.driveSnapshot,
      }),
    }
  }

  const rule = findAlignmentRule({
    goalType: params.goal.type,
    driveSnapshot: params.driveSnapshot,
  })

  if (rule) {
    return {
      ...params.goal,
      type: rule.to,
      summary: `${params.goal.summary} drive 校正：${rule.summary}`,
      driveAlignment: {
        dominantDrive: params.driveSnapshot.dominant,
        originalType: params.goal.type,
        alignedType: rule.to,
        summary: rule.summary,
        changed: rule.to !== params.goal.type,
      },
    }
  }

  if (
    params.goal.type === "idle_drift" &&
    shouldAlignIdleDrift(params.driveSnapshot)
  ) {
    const alignedType =
      GOAL_DRIVE_TO_GOAL_TYPE[params.driveSnapshot.dominant]

    const summary =
      "当前主导 drive 已经变得明确，弱目标被轻量校正为更清晰的目标方向。"

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

  return {
    ...params.goal,
    driveAlignment: buildNoChangeAlignment({
      goal: params.goal,
      driveSnapshot: params.driveSnapshot,
    }),
  }
}