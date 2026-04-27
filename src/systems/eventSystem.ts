/**
 * 当前文件负责：监听世界状态变化并生成世界事件
 */

import { buildPetEvent } from "../ai/gateway"
import type { PetAction } from "../types/pet"
import type { WorldEvent, NarrativeType } from "../types/event"

import {
  buildActionEventStyleInput,
  buildMoodEventStyleInput,
  createContinuityId,
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
  type ContinuityState,
  type EventSystemUpdateInput,
  type InteractionEventInput,
  type PetHatchedEventInput,
  type PetStateLike,
} from "./event/event-gateway"

function shouldEmitActionNarrativeEvent(params: {
  tick: number
  prevAction: PetAction
  currentAction: PetAction
}): boolean {
  if (params.prevAction !== params.currentAction) {
    return true
  }

  return params.tick % 3 === 0
}

function shouldResetContinuity(params: {
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

  if (!existing) {
    return true
  }

  if (existing.action !== currentAction) {
    return true
  }

  if (existing.narrativeType !== currentNarrativeType) {
    return true
  }

  if (existing.drivePrimary !== currentDrivePrimary) {
    return true
  }

  if (existing.sourceDrive !== currentSourceDrive) {
    return true
  }

  if (currentTick - existing.lastTick > 6) {
    return true
  }

  return false
}

function buildEnhancedActionEventPayload(params: {
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

function decorateNarrativeMessageByContinuity(params: {
  baseMessage: string
  step: number
  action: PetAction
  narrativeType: NarrativeType
}): string {
  const { baseMessage, step, action, narrativeType } = params

  if (step <= 1) {
    return baseMessage
  }

  if (step === 2) {
    if (action === "walking") {
      return `随后，${baseMessage}`
    }

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
    if (action === "walking") {
      return `又过了一会儿，${baseMessage}`
    }

    if (action === "exploring") {
      return `紧接着，${baseMessage}`
    }

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

function buildWalkingEndMessage(params: {
  petName: string
  narrativeType: NarrativeType
  phaseTag: string | null
  emotionalLabel: string | null
  drivePrimary: string | null
  sourceDrive: string | null
}): string {
  const {
    petName,
    narrativeType,
    phaseTag,
    emotionalLabel,
    drivePrimary,
    sourceDrive,
  } = params

  if (
    sourceDrive === "approach" ||
    drivePrimary === "approach" ||
    narrativeType === "approach_target"
  ) {
    return `${petName}把刚才那阵试着靠近的步子慢慢收住了，没有再继续把距离往前压近。`
  }

  if (sourceDrive === "avoid") {
    return `${petName}把原本带着防备的移动慢慢收了回来，像是暂时先把距离稳在了这里。`
  }

  if (phaseTag === "recovery_phase") {
    return `${petName}慢慢把脚步收了回来，像是觉得现在先把状态稳住更重要。`
  }

  if (emotionalLabel === "alert") {
    return `${petName}没有再继续走动，刚才那阵带着留意的活动也慢慢停了下来。`
  }

  if (narrativeType === "observe_environment") {
    return `${petName}绕着附近确认了一阵后，慢慢停下了脚步，注意力也没有再继续往外铺开。`
  }

  if (narrativeType === "linger") {
    return `${petName}那阵低强度的活动渐渐收住了，最后又把自己留回了原地。`
  }

  return `${petName}慢慢停下了脚步，刚才那阵来回活动也跟着收了下来。`
}

function buildExploringEndMessage(params: {
  petName: string
  narrativeType: NarrativeType
  phaseTag: string | null
  emotionalLabel: string | null
}): string {
  const { petName, narrativeType, phaseTag, emotionalLabel } = params

  if (narrativeType === "discover") {
    if (phaseTag === "growth_phase") {
      return `${petName}把刚才那阵探索慢慢收住了，像是已经把这一轮新鲜变化看得差不多了。`
    }

    return `${petName}把刚才那阵探索慢慢收住了，像是暂时看够了周围的新变化。`
  }

  if (emotionalLabel === "alert" || phaseTag === "sensitive_phase") {
    return `${petName}没有再继续把注意力往外放开，刚才那阵探索也在谨慎里慢慢停了下来。`
  }

  if (phaseTag === "attachment_phase") {
    return `${petName}把向外探索的劲头先收了一些，像是开始把注意力转回更亲近的方向。`
  }

  return `${petName}慢慢停下了探索，注意力没有再继续向外扩开。`
}

function buildApproachingEndMessage(params: {
  petName: string
  phaseTag: string | null
  emotionalLabel: string | null
  drivePrimary: string | null
}): string {
  const { petName, phaseTag, emotionalLabel, drivePrimary } = params

  if (phaseTag === "attachment_phase") {
    return `${petName}没有再继续靠近，像是在已经足够安心的位置上慢慢停了下来。`
  }

  if (emotionalLabel === "alert" || drivePrimary === "avoid") {
    return `${petName}原本想缩短距离的动作慢慢收住了，像是又重新留出了一点观察空间。`
  }

  return `${petName}没有再继续靠近，刚才那股想缩短距离的动作慢慢停了下来。`
}

function buildIdleEndMessage(params: {
  petName: string
  phaseTag: string | null
  emotionalLabel: string | null
  sourceDrive: string | null
}): string {
  const { petName, phaseTag, emotionalLabel, sourceDrive } = params

  if (sourceDrive === "observe") {
    return `${petName}结束了刚才那段安静观察，像是已经准备把注意力转向新的方向。`
  }

  if (phaseTag === "recovery_phase") {
    return `${petName}结束了刚才那段安静回收的停留，像是准备把状态重新向外放一点。`
  }

  if (emotionalLabel === "low") {
    return `${petName}从刚才那阵安静里慢慢缓了出来，像是终于愿意再向外动一点。`
  }

  return `${petName}结束了刚才那段停留，像是准备转向新的动作。`
}

function buildObservingEndMessage(params: {
  petName: string
  emotionalLabel: string | null
}): string {
  const { petName, emotionalLabel } = params

  if (emotionalLabel === "alert") {
    return `${petName}把刚才那阵持续留意周围的状态慢慢放了下来，像是确认眼前暂时没有更近一步的变化。`
  }

  return `${petName}结束了刚才那段安静观察，注意力也慢慢从周围收了回来。`
}

function buildRestingEndMessage(params: {
  petName: string
  phaseTag: string | null
}): string {
  const { petName, phaseTag } = params

  if (phaseTag === "recovery_phase") {
    return `${petName}从刚才那阵缓慢恢复里慢慢抽离出来，像是已经把状态稍微稳住了一些。`
  }

  return `${petName}结束了刚才那段安静休整，像是准备重新把注意力放回外界。`
}

function buildAlertIdleEndMessage(params: {
  petName: string
  emotionalLabel: string | null
}): string {
  const { petName, emotionalLabel } = params

  if (emotionalLabel === "alert" || emotionalLabel === "anxious") {
    return `${petName}原本绷着的那点警惕慢慢松下去了一些，没有继续把自己停在那种紧绷状态里。`
  }

  return `${petName}把刚才那阵带着防备的停留慢慢收住了。`
}

function buildSleepingEndMessage(params: {
  petName: string
  emotionalLabel: string | null
}): string {
  const { petName, emotionalLabel } = params

  if (emotionalLabel === "relaxed" || emotionalLabel === "content") {
    return `${petName}从刚才那阵安稳的休息里慢慢醒转过来，状态也显得比先前更松一点。`
  }

  return `${petName}从刚才那阵安静休息里慢慢醒转过来。`
}

function buildEatingEndMessage(params: {
  petName: string
  phaseTag: string | null
  emotionalLabel: string | null
}): string {
  const { petName, phaseTag, emotionalLabel } = params

  if (phaseTag === "recovery_phase" || emotionalLabel === "content") {
    return `${petName}慢慢停下了进食，刚才那阵回应身体需求的状态也像是被安稳地补回来了一些。`
  }

  if (emotionalLabel === "excited") {
    return `${petName}把进食的动作慢慢收住了，像是这一轮需求已经先被回应住了。`
  }

  return `${petName}慢慢停下了进食，刚才那阵专注回应需求的状态也收了下来。`
}

function buildActionEndMessage(params: {
  pet: PetStateLike
  action: PetAction
  narrativeType: NarrativeType
  drivePrimary: string | null
  sourceDrive: string | null
}): string {
  const { pet, action, narrativeType, drivePrimary, sourceDrive } = params

  const petName = pet.name
  const phaseTag = getPhaseTag(pet)
  const emotionalLabel = getEmotionalLabel(pet)

  if (action === "walking") {
    return buildWalkingEndMessage({
      petName,
      narrativeType,
      phaseTag,
      emotionalLabel,
      drivePrimary,
      sourceDrive,
    })
  }

  if (action === "exploring") {
    return buildExploringEndMessage({
      petName,
      narrativeType,
      phaseTag,
      emotionalLabel,
    })
  }

  if (action === "approaching") {
    return buildApproachingEndMessage({
      petName,
      phaseTag,
      emotionalLabel,
      drivePrimary,
    })
  }

  if (action === "idle") {
    return buildIdleEndMessage({
      petName,
      phaseTag,
      emotionalLabel,
      sourceDrive,
    })
  }

  if (action === "observing") {
    return buildObservingEndMessage({
      petName,
      emotionalLabel,
    })
  }

  if (action === "resting") {
    return buildRestingEndMessage({
      petName,
      phaseTag,
    })
  }

  if (action === "alert_idle") {
    return buildAlertIdleEndMessage({
      petName,
      emotionalLabel,
    })
  }

  if (action === "sleeping") {
    return buildSleepingEndMessage({
      petName,
      emotionalLabel,
    })
  }

  if (action === "eating") {
    return buildEatingEndMessage({
      petName,
      phaseTag,
      emotionalLabel,
    })
  }

  return `${petName}慢慢停下了刚才的行动。`
}

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