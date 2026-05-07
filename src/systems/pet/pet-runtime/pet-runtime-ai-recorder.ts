/**
 * 当前文件负责：把宠物单 Tick 行为决策记录进 AI Data Core。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { PetAction, PetState } from "@/types/pet"
import type {
  ActionDecisionReason,
  DriveSnapshot,
  DriveType,
  PetGoalState,
} from "../pet-gateway"

import { recordAiDecision } from "@/ai/data-core/ai-data-gateway"

const DRIVE_LABELS: Record<DriveType, string> = {
  eat: "进食驱动",
  rest: "休息驱动",
  avoid: "回避驱动",
  approach: "靠近驱动",
  explore: "探索驱动",
  observe: "观察驱动",
}

type RecordPetRuntimeDecisionInput = {
  tick: number
  pet: PetState
  time: TimeState
  previousAction: PetAction
  rawAction: PetAction
  expressedAction: PetAction
  finalAction: PetAction
  actionSelectionReason: ActionDecisionReason
  expressionReason: string
  expressionSummary: string
  stabilityReason: ActionDecisionReason
  driveSnapshot: DriveSnapshot
  currentGoal: PetGoalState
}

function buildDriveCandidates(driveSnapshot: DriveSnapshot) {
  return (Object.entries(driveSnapshot.values) as [DriveType, number][]).map(
    ([drive, score]) => ({
      id: `drive:${drive}`,
      label: DRIVE_LABELS[drive],
      score,
      reasons: driveSnapshot.reasons[drive] ?? [],
    })
  )
}

export function recordPetRuntimeDecision(
  input: RecordPetRuntimeDecisionInput
): void {
  recordAiDecision({
    source: "pet_system",
    entityType: "pet",
    entityId: input.pet.name,
    importance: "medium",
    userVisibleChannel: "hidden",
    summary: `宠物行为决策：${input.previousAction} → ${input.finalAction}`,
    tags: [
      "pet-runtime",
      "behavior-decision",
      `drive:${input.driveSnapshot.dominant}`,
      `action:${input.finalAction}`,
      `goal:${input.currentGoal.type}`,
    ],

    beforeState: {
      label: "pet_state_before_decision",
      values: {
        tick: input.tick,
        day: input.time.day,
        hour: input.time.hour,
        period: input.time.period,
        energy: input.pet.energy,
        hunger: input.pet.hunger,
        mood: input.pet.mood,
        previousAction: input.previousAction,
        lifePhase: input.pet.lifeState.phase,
      },
      tags: ["pet", "before-decision"],
    },

    afterState: {
      label: "pet_decision_result",
      values: {
        rawAction: input.rawAction,
        expressedAction: input.expressedAction,
        finalAction: input.finalAction,
        dominantDrive: input.driveSnapshot.dominant,
        dominantDriveScore: input.driveSnapshot.dominantScore,
        goalType: input.currentGoal.type,
        goalPriority: input.currentGoal.priority,
        goalSource: input.currentGoal.source,
      },
      tags: ["pet", "decision-result"],
    },

    candidates: buildDriveCandidates(input.driveSnapshot),
    selectedCandidateId: `drive:${input.driveSnapshot.dominant}`,

    reason: {
      mainReason: input.stabilityReason,
      drive: input.driveSnapshot.dominant,
      stateGate: input.actionSelectionReason,
      environmentBias: input.expressionReason,
      notes: [
        input.driveSnapshot.summary,
        input.expressionSummary,
        input.currentGoal.summary,
      ],
    },
  })
}