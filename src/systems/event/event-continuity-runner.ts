/**
 * 当前文件负责：处理宠物连续叙事事件的连续性判断与文案衔接。
 */

import type { NarrativeType } from "@/types/event"
import type { PetAction } from "@/types/pet"
import type {
  ContinuityState,
  PetStateLike,
} from "./event-schema"
import {
  getLegacyDrivePrimary,
  getPetEventKey,
} from "./event-pet-context-runner"

export function shouldEmitActionNarrativeEvent(params: {
  tick: number
  prevAction: PetAction
  currentAction: PetAction
}): boolean {
  if (params.prevAction !== params.currentAction) {
    return true
  }

  return params.tick % 3 === 0
}

export function shouldResetContinuity(params: {
  existing: ContinuityState | undefined
  currentTick: number
  currentAction: PetAction
  currentNarrativeType: NarrativeType
  currentDrivePrimary: string | null
  currentSourceDrive: string | null
}): boolean {
  const {
    existing,
    currentTick,
    currentAction,
    currentNarrativeType,
    currentDrivePrimary,
    currentSourceDrive,
  } = params

  if (!existing) return true
  if (existing.action !== currentAction) return true
  if (existing.narrativeType !== currentNarrativeType) return true
  if (existing.drivePrimary !== currentDrivePrimary) return true
  if (existing.sourceDrive !== currentSourceDrive) return true
  if (currentTick - existing.lastTick > 6) return true

  return false
}

export function buildEnhancedActionEventPayload(params: {
  pet: PetStateLike
  prevAction: PetAction
  currentAction: PetAction
  narrativeType: NarrativeType
  continuityId: string
  intensity: number
  continuityStep: number
  sourceDrive: string | null
}): Record<string, unknown> {
  return {
    petKey: getPetEventKey(params.pet),
    prevAction: params.prevAction,
    currentAction: params.currentAction,
    drivePrimary: getLegacyDrivePrimary(params.pet),
    sourceDrive: params.sourceDrive,
    narrativeType: params.narrativeType,
    continuityId: params.continuityId,
    intensity: params.intensity,
    continuityStep: params.continuityStep,
    emotionalLabel:
      params.pet.timelineSnapshot?.state.emotional.label ?? null,
    phaseTag:
      params.pet.timelineSnapshot?.fortune.phaseTag ?? null,
    branchTag:
      params.pet.timelineSnapshot?.trajectory.branchTag ?? null,
  }
}

export function decorateNarrativeMessageByContinuity(params: {
  baseMessage: string
  step: number
  action: PetAction
  narrativeType: NarrativeType
}): string {
  const { baseMessage, step, action, narrativeType } = params

  if (step <= 1) return baseMessage

  if (step === 2) {
    if (action === "walking") return `随后，${baseMessage}`

    if (action === "exploring" && narrativeType === "discover") {
      return `接着，${baseMessage}`
    }

    if (
      action === "idle" ||
      action === "sleeping" ||
      action === "resting" ||
      action === "observing" ||
      action === "alert_idle"
    ) {
      return `又安静了一会儿，${baseMessage}`
    }

    return `接着，${baseMessage}`
  }

  if (step === 3) {
    if (action === "walking") return `又过了一会儿，${baseMessage}`
    if (action === "exploring") return `紧接着，${baseMessage}`

    if (
      action === "idle" ||
      action === "sleeping" ||
      action === "resting" ||
      action === "observing" ||
      action === "alert_idle"
    ) {
      return `再过一会儿，${baseMessage}`
    }

    return `随后，${baseMessage}`
  }

  if (action === "walking" || action === "exploring") {
    return `它没有立刻停下，${baseMessage}`
  }

  if (
    action === "idle" ||
    action === "sleeping" ||
    action === "resting" ||
    action === "observing" ||
    action === "alert_idle"
  ) {
    return `它仍旧维持着这样的状态，${baseMessage}`
  }

  return `它继续这样行动着，${baseMessage}`
}