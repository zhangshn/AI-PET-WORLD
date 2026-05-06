/**
 * 当前文件负责：封装宠物单 Tick 的完整运行流程。
 */

import type { TimeState } from "@/engine/timeSystem"
import type { PetState, PetAction } from "@/types/pet"
import type { WorldZone } from "@/world/ecology/world-zone-types"

import {
  updatePetAiState,
  stepPetBehaviorProcess,
} from "@/ai/gateway"

import {
  updatePetMemoryState,
} from "@/ai/memory-core/memory-gateway"

import {
  logPetDecisionTrace,
} from "@/engine/world-engine/world-runtime-logger"

import {
  runPetLife,
  runPetZoneInfluence,
  buildPetStateEvents,
  mapTimelineStateToPetMood,
  applyPetActionStability,
  selectPetAction,
  expressPetAction,
  driveSystem,
  attentionSystem,
  goalSystem,
  type ActionDecisionReason,
  type ActionStabilityState,
  type DriveSnapshot,
} from "../pet-gateway"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export type RunPetRuntimeTickInput = {
  pet: PetState | null
  currentTick: number
  time: TimeState
  zones: WorldZone[]
  actionStability: ActionStabilityState | null
  lastFeedingTick: number
}

export type RunPetRuntimeTickResult = {
  pet: PetState | null
  actionStability: ActionStabilityState | null
  lastDriveSnapshot: DriveSnapshot | null
  lastDecisionReason: ActionDecisionReason | null
}

function buildDriveSnapshot(input: {
  pet: PetState
  time: TimeState
}): DriveSnapshot {
  return driveSystem.compute({
    pet: {
      energy: input.pet.energy,
      hunger: input.pet.hunger,
      mood: input.pet.mood,
      timelineSnapshot: input.pet.timelineSnapshot,
      personalityProfile: input.pet.personalityProfile,
      consciousnessProfile: input.pet.consciousnessProfile,
      memoryState: input.pet.memoryState,
      currentLifeRuntimeBundle:
        input.pet.currentLifeRuntimeBundle ?? null,
      latestCognition: input.pet.latestCognition ?? null,
    },
    time: input.time,
  })
}

export function runPetRuntimeTick(
  input: RunPetRuntimeTickInput
): RunPetRuntimeTickResult {
  if (!input.pet || !input.pet.timelineSnapshot) {
    return {
      pet: input.pet,
      actionStability: input.actionStability,
      lastDriveSnapshot: null,
      lastDecisionReason: null,
    }
  }

  let pet = runPetLife({
    pet: input.pet,
  }).pet

  const currentSnapshot = pet.timelineSnapshot

  if (!currentSnapshot) {
    return {
      pet,
      actionStability: input.actionStability,
      lastDriveSnapshot: null,
      lastDecisionReason: null,
    }
  }

  const energyBefore = Math.round(pet.energy)
  const hungerBefore = Math.round(pet.hunger)
  const moodBefore = currentSnapshot.state.emotional.label

  attentionSystem.decayAttention(input.currentTick)

  let forcedAction: PetAction | undefined

  if (pet.activeBehaviorProcess) {
    const processResult = stepPetBehaviorProcess({
      tick: input.currentTick,
      process: pet.activeBehaviorProcess,
      energy: pet.energy,
      hunger: pet.hunger,
    })

    pet.activeBehaviorProcess = processResult.nextProcess
    forcedAction = processResult.suggestedAction

    pet.energy = clamp(
      pet.energy + processResult.delta.energyDelta,
      0,
      100
    )

    pet.hunger = clamp(
      pet.hunger + processResult.delta.hungerDelta,
      0,
      100
    )

    if (processResult.delta.emotionalShift >= 8) {
      pet.mood = "happy"
    } else if (processResult.delta.emotionalShift <= -8) {
      pet.mood = "alert"
    }
  }

  /**
   * 先根据当前身体、记忆、认知、生命趋向计算 drive。
   * previousGoal 仍然保留在 pet.currentGoal 中，但不会让 goal 先于 drive 决定方向。
   */
  const driveSnapshot = buildDriveSnapshot({
    pet,
    time: input.time,
  })

  const nextGoal = goalSystem.compute({
    tick: input.currentTick,
    pet: {
      energy: pet.energy,
      hunger: pet.hunger,
      mood: pet.mood,
      timelineSnapshot: currentSnapshot,
      consciousnessProfile: pet.consciousnessProfile,
      memoryState: pet.memoryState,
      currentLifeRuntimeBundle: pet.currentLifeRuntimeBundle ?? null,
    },
    time: input.time,
    previousGoal: pet.currentGoal ?? null,
    driveSnapshot,
    zones: input.zones,
  })

  pet.currentGoal = nextGoal

  const actionSelection = forcedAction
    ? {
        action: forcedAction,
        reason: "goal_guided_selection" as ActionDecisionReason,
      }
    : selectPetAction({
        pet,
        dominantDrive: driveSnapshot.dominant,
        currentGoal: nextGoal,
        snapshot: currentSnapshot,
        driveSnapshot,
      })

  const rawAction = actionSelection.action

  const expressionResult = expressPetAction({
    rawAction,
    currentAction: pet.action,
    currentGoal: nextGoal,
    lifePhase: pet.lifeState.phase,
    energy: pet.energy,
    hunger: pet.hunger,
    currentLifeRuntimeBundle: pet.currentLifeRuntimeBundle ?? null,
    latestCognition: pet.latestCognition ?? null,
  })

  const expressedAction = expressionResult.expressedAction

  const stabilityResult = applyPetActionStability({
    currentTick: input.currentTick,
    candidate: expressedAction,
    currentPetAction: pet.action,
    energy: pet.energy,
    hunger: pet.hunger,
    stability: input.actionStability,
    shouldHoldCurrentAction: (payload) =>
      attentionSystem.shouldHoldCurrentAction(payload),
  })

  const finalAction = stabilityResult.action
  const previousAction = pet.action

  logPetDecisionTrace({
    tick: input.currentTick,
    petName: pet.name,
    previousAction,
    rawAction,
    expressedAction,
    finalAction,
    actionSelectionReason: actionSelection.reason,
    expressionReason: expressionResult.reason,
    expressionSummary: expressionResult.summary,
    stabilityReason: stabilityResult.reason,
    driveDominant: driveSnapshot.dominant,
    driveDominantScore: driveSnapshot.dominantScore,
    driveValues: driveSnapshot.values,
    driveReasons: driveSnapshot.reasons,
    goalType: nextGoal.type,
    goalPriority: nextGoal.priority,
    goalSource: nextGoal.source,
    goalSummary: nextGoal.summary,
    goalLifeTendencyHint: nextGoal.lifeTendencyHint ?? null,
    goalDriveAlignment: nextGoal.driveAlignment ?? null,
    energy: pet.energy,
    hunger: pet.hunger,
    mood: currentSnapshot.state.emotional.label,
    lifePhase: pet.lifeState.phase,
  })

  pet.action = finalAction

  pet = runPetZoneInfluence({
    pet,
    action: finalAction,
    zones: input.zones,
  }).pet

  if (previousAction !== finalAction || !attentionSystem.getAttention()) {
    attentionSystem.lockAttention({
      tick: input.currentTick,
      currentAction: finalAction,
      dominantDrive: driveSnapshot.dominant,
      energy: pet.energy,
      hunger: pet.hunger,
      emotionalLabel: currentSnapshot.state.emotional.label,
      phaseTag: currentSnapshot.fortune.phaseTag,
      branchTag: currentSnapshot.trajectory.branchTag,
    })
  }

  const nextSnapshot = updatePetAiState({
    currentSnapshot,
    time: input.time,
    events: buildPetStateEvents(finalAction),
    behaviorShift: {
      previousAction,
      nextAction: finalAction,
      impact: 0.2,
    },
    tickDelta: 1,
    shouldRefreshTrajectory: true,
    playerRelation: {
      familiarity: 60,
      attachment: 45,
      trust: 55,
      distance: 15,
    },
  })

  nextSnapshot.state.physical.energy = pet.energy
  nextSnapshot.state.physical.hunger = pet.hunger

  pet.timelineSnapshot = nextSnapshot
  pet.energy = Math.round(nextSnapshot.state.physical.energy)
  pet.hunger = Math.round(nextSnapshot.state.physical.hunger)
  pet.mood = mapTimelineStateToPetMood(nextSnapshot.state.emotional.label)

  const wasFed = input.currentTick - input.lastFeedingTick <= 1

  pet.memoryState = updatePetMemoryState({
    previousMemory: pet.memoryState,
    tick: input.currentTick,
    time: {
      day: input.time.day,
      hour: input.time.hour,
      period: input.time.period,
    },
    action: finalAction,
    energyBefore,
    energyAfter: pet.energy,
    hungerBefore,
    hungerAfter: pet.hunger,
    moodBefore,
    moodAfter: nextSnapshot.state.emotional.label,
    wasFed,
  })

  return {
    pet,
    actionStability: stabilityResult.stability,
    lastDriveSnapshot: driveSnapshot,
    lastDecisionReason: stabilityResult.reason,
  }
}