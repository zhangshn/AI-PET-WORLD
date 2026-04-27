/**
 * 当前文件负责：根据宠物前后状态变化生成宠物相关世界事件。
 */

import { buildPetEvent } from "@/ai/gateway"
import type { WorldEvent } from "@/types/event"
import type { ContinuityState, PetStateLike } from "./event-schema"
import {
  buildActionEndMessage,
  buildActionEventStyleInput,
  buildEnhancedActionEventPayload,
  buildMoodEventStyleInput,
  createContinuityId,
  decorateNarrativeMessageByContinuity,
  getActionEventIntensity,
  getEmotionalLabel,
  getEventAction,
  getEventMood,
  getLegacyDrivePrimary,
  getNarrativeTypeByAction,
  getPetEventKey,
  getPhaseTag,
  getSourceDriveFromPet,
  makeWorldEvent,
  shouldEmitActionNarrativeEvent,
  shouldResetContinuity,
} from "./event-gateway"

export type BuildPetUpdateEventsInput = {
  tick: number
  day: number
  hour: number
  prevPet: PetStateLike
  currentPet: PetStateLike
  continuityByPetKey: Map<string, ContinuityState>
}

export function buildPetUpdateEvents(
  input: BuildPetUpdateEventsInput
): WorldEvent[] {
  const events: WorldEvent[] = []

  const { tick, day, hour, prevPet, currentPet, continuityByPetKey } = input

  const petKey = getPetEventKey(currentPet)

  const prevAction = getEventAction(prevPet)
  const currentAction = getEventAction(currentPet)
  const prevContinuity = continuityByPetKey.get(petKey)

  if (prevAction !== currentAction) {
    if (prevContinuity) {
      const endMessage = buildActionEndMessage({
        pet: currentPet,
        action: prevContinuity.action,
        narrativeType: prevContinuity.narrativeType,
        drivePrimary: prevContinuity.drivePrimary,
        sourceDrive: prevContinuity.sourceDrive,
      })

      events.push(
        makeWorldEvent({
          tick,
          day,
          hour,
          type: "pet_action_end",
          petName: currentPet.name,
          message: endMessage,
          sourceAction: prevContinuity.action,
          narrativeType: prevContinuity.narrativeType,
          continuityId: prevContinuity.continuityId,
          intensity: 0.3,
          payload: {
            petKey,
            endedAction: prevContinuity.action,
            continuityId: prevContinuity.continuityId,
            continuityStep: prevContinuity.step,
            emotionalLabel: getEmotionalLabel(currentPet),
            phaseTag: getPhaseTag(currentPet),
            drivePrimary: prevContinuity.drivePrimary,
            sourceDrive: prevContinuity.sourceDrive,
          },
        })
      )
    }

    continuityByPetKey.delete(petKey)

    const styleInput = buildActionEventStyleInput(currentPet, currentAction)
    const message = buildPetEvent(styleInput)

    events.push(
      makeWorldEvent({
        tick,
        day,
        hour,
        type: "pet_action_changed",
        petName: currentPet.name,
        message,
        sourceAction: currentAction,
        payload: {
          petKey,
          prevAction,
          currentAction,
          drivePrimary: getLegacyDrivePrimary(currentPet),
          sourceDrive: getSourceDriveFromPet(currentPet),
        },
      })
    )
  }

  if (
    shouldEmitActionNarrativeEvent({
      tick,
      prevAction,
      currentAction,
    })
  ) {
    const narrativeType = getNarrativeTypeByAction(currentAction, currentPet)
    const intensity = getActionEventIntensity(currentPet)
    const drivePrimary = getLegacyDrivePrimary(currentPet)
    const sourceDrive = getSourceDriveFromPet(currentPet)

    const existing = continuityByPetKey.get(petKey)

    let continuityState: ContinuityState

    if (
      shouldResetContinuity({
        existing,
        currentTick: tick,
        currentAction,
        currentNarrativeType: narrativeType,
        currentDrivePrimary: drivePrimary,
        currentSourceDrive: sourceDrive,
      })
    ) {
      continuityState = {
        continuityId: createContinuityId(),
        step: 1,
        action: currentAction,
        narrativeType,
        drivePrimary,
        sourceDrive,
        lastTick: tick,
      }
    } else {
      continuityState = {
        continuityId: existing!.continuityId,
        step: existing!.step + 1,
        action: currentAction,
        narrativeType,
        drivePrimary,
        sourceDrive,
        lastTick: tick,
      }
    }

    continuityByPetKey.set(petKey, continuityState)

    const styleInput = buildActionEventStyleInput(
      currentPet,
      currentAction,
      undefined,
      {
        intensity,
        narrativeType,
        continuityId: continuityState.continuityId,
        continuityStep: continuityState.step,
      }
    )

    const baseMessage = buildPetEvent(styleInput)
    const message = decorateNarrativeMessageByContinuity({
      baseMessage,
      step: continuityState.step,
      action: currentAction,
      narrativeType,
    })

    events.push(
      makeWorldEvent({
        tick,
        day,
        hour,
        type: "pet_action_narrative",
        petName: currentPet.name,
        message,
        sourceAction: currentAction,
        narrativeType,
        continuityId: continuityState.continuityId,
        intensity,
        payload: buildEnhancedActionEventPayload({
          pet: currentPet,
          prevAction,
          currentAction,
          narrativeType,
          continuityId: continuityState.continuityId,
          intensity,
          continuityStep: continuityState.step,
          sourceDrive,
        }),
      })
    )
  }

  const prevMood = getEventMood(prevPet)
  const currentMood = getEventMood(currentPet)

  if (prevMood !== currentMood) {
    const styleInput = buildMoodEventStyleInput(currentPet, currentMood)
    const message = buildPetEvent(styleInput)

    events.push(
      makeWorldEvent({
        tick,
        day,
        hour,
        type: "pet_mood_changed",
        petName: currentPet.name,
        message,
        payload: {
          petKey,
          prevMood,
          currentMood,
          emotionalLabel:
            currentPet.timelineSnapshot?.state.emotional.label ?? null,
          sourceDrive: getSourceDriveFromPet(currentPet),
        },
      })
    )
  }

  const prevPhase = prevPet.timelineSnapshot?.fortune.phaseTag
  const currentPhase = currentPet.timelineSnapshot?.fortune.phaseTag

  if (prevPhase && currentPhase && prevPhase !== currentPhase) {
    events.push(
      makeWorldEvent({
        tick,
        day,
        hour,
        type: "pet_fortune_phase_changed",
        petName: currentPet.name,
        message: `${currentPet.name}进入了新的阶段倾向：${currentPhase}。`,
        payload: {
          petKey,
          prevPhase,
          currentPhase,
          fortuneSummary: currentPet.timelineSnapshot?.fortune.summary ?? null,
          sourceDrive: getSourceDriveFromPet(currentPet),
        },
      })
    )
  }

  const prevBranch = prevPet.timelineSnapshot?.trajectory.branchTag
  const currentBranch = currentPet.timelineSnapshot?.trajectory.branchTag

  if (prevBranch && currentBranch && prevBranch !== currentBranch) {
    events.push(
      makeWorldEvent({
        tick,
        day,
        hour,
        type: "pet_trajectory_branch_changed",
        petName: currentPet.name,
        message: `${currentPet.name}的生命轨迹开始向新的方向偏移了。`,
        payload: {
          petKey,
          prevBranch,
          currentBranch,
          trajectorySummary:
            currentPet.timelineSnapshot?.trajectory.summary ?? null,
          sourceDrive: getSourceDriveFromPet(currentPet),
        },
      })
    )
  }

  return events
}