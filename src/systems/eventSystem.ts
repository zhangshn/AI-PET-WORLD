/**
 * 当前文件负责：监听世界状态变化并生成世界事件
 */

import { buildPetEvent } from "../ai/gateway"
import type { WorldEvent } from "../types/event"

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
  type ContinuityState,
  type EventSystemUpdateInput,
  type InteractionEventInput,
  type PetHatchedEventInput,
  type PetStateLike,
} from "./event/event-gateway"

export class EventSystem {
  private events: WorldEvent[] = []
  private continuityByPetKey = new Map<string, ContinuityState>()

  getEvents(): WorldEvent[] {
    return this.events
  }

  addInteractionEvent(input: InteractionEventInput): void {
    const event = makeWorldEvent({
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "interaction",
      message: input.message,
    })

    this.events.push(event)
  }

  addPetHatchedEvent(input: PetHatchedEventInput): void {
    const event = makeWorldEvent({
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "pet_hatched",
      petName: input.petName,
      message: `${input.petName}破壳出生了。`,
    })

    this.events.push(event)
  }

  update(input: EventSystemUpdateInput): void {
    if (input.prevPeriod !== input.currentPeriod) {
      const event = makeWorldEvent({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        type: "time_period_changed",
        message: `时间进入了新的阶段：${input.currentPeriod}。`,
        payload: {
          prevPeriod: input.prevPeriod,
          currentPeriod: input.currentPeriod,
        },
      })

      this.events.push(event)
    }

    if (input.prevPet && input.currentPet) {
      const prevPet = input.prevPet as PetStateLike
      const currentPet = input.currentPet as PetStateLike
      const petKey = getPetEventKey(currentPet)

      const prevAction = getEventAction(prevPet)
      const currentAction = getEventAction(currentPet)
      const prevContinuity = this.continuityByPetKey.get(petKey)

      if (prevAction !== currentAction) {
        if (prevContinuity) {
          const endMessage = buildActionEndMessage({
            pet: currentPet,
            action: prevContinuity.action,
            narrativeType: prevContinuity.narrativeType,
            drivePrimary: prevContinuity.drivePrimary,
            sourceDrive: prevContinuity.sourceDrive,
          })

          const endEvent = makeWorldEvent({
            tick: input.tick,
            day: input.day,
            hour: input.hour,
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

          this.events.push(endEvent)
        }

        this.continuityByPetKey.delete(petKey)

        const styleInput = buildActionEventStyleInput(
          currentPet,
          currentAction
        )

        const message = buildPetEvent(styleInput)

        const event = makeWorldEvent({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
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

        this.events.push(event)
      }

      if (
        shouldEmitActionNarrativeEvent({
          tick: input.tick,
          prevAction,
          currentAction,
        })
      ) {
        const narrativeType = getNarrativeTypeByAction(
          currentAction,
          currentPet
        )
        const intensity = getActionEventIntensity(currentPet)
        const drivePrimary = getLegacyDrivePrimary(currentPet)
        const sourceDrive = getSourceDriveFromPet(currentPet)

        const existing = this.continuityByPetKey.get(petKey)

        let continuityState: ContinuityState

        if (
          shouldResetContinuity({
            existing,
            currentTick: input.tick,
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
            lastTick: input.tick,
          }
        } else {
          continuityState = {
            continuityId: existing!.continuityId,
            step: existing!.step + 1,
            action: currentAction,
            narrativeType,
            drivePrimary,
            sourceDrive,
            lastTick: input.tick,
          }
        }

        this.continuityByPetKey.set(petKey, continuityState)

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

        const event = makeWorldEvent({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
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

        this.events.push(event)
      }

      const prevMood = getEventMood(prevPet)
      const currentMood = getEventMood(currentPet)

      if (prevMood !== currentMood) {
        const styleInput = buildMoodEventStyleInput(
          currentPet,
          currentMood
        )

        const message = buildPetEvent(styleInput)

        const event = makeWorldEvent({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
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

        this.events.push(event)
      }

      const prevPhase = prevPet.timelineSnapshot?.fortune.phaseTag
      const currentPhase = currentPet.timelineSnapshot?.fortune.phaseTag

      if (prevPhase && currentPhase && prevPhase !== currentPhase) {
        const event = makeWorldEvent({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
          type: "pet_fortune_phase_changed",
          petName: currentPet.name,
          message: `${currentPet.name}进入了新的阶段倾向：${currentPhase}。`,
          payload: {
            petKey,
            prevPhase,
            currentPhase,
            fortuneSummary:
              currentPet.timelineSnapshot?.fortune.summary ?? null,
            sourceDrive: getSourceDriveFromPet(currentPet),
          },
        })

        this.events.push(event)
      }

      const prevBranch = prevPet.timelineSnapshot?.trajectory.branchTag
      const currentBranch =
        currentPet.timelineSnapshot?.trajectory.branchTag

      if (prevBranch && currentBranch && prevBranch !== currentBranch) {
        const event = makeWorldEvent({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
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

        this.events.push(event)
      }
    }

    if (
      input.prevIncubator.progress !== input.currentIncubator.progress
    ) {
      const added =
        input.currentIncubator.progress - input.prevIncubator.progress

      if (added > 0) {
        const event = makeWorldEvent({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
          type: "incubator_progress_changed",
          message: `孵化器的进度又向前推进了一些。`,
          payload: {
            addedProgress: added,
            progress: input.currentIncubator.progress,
          },
        })

        this.events.push(event)
      }
    }
  }
}

export default EventSystem