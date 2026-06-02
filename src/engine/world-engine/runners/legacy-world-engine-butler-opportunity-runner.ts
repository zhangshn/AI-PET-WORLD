/**
 * 当前文件负责：处理管家提供给宠物的机会事件，并把宠物自主选择结果写入系统。
 */

import type { TimeState } from "../../timeSystem"
import type { NarrativeType } from "@/types/event"
import type { ButlerSystem } from "@/systems/butlerSystem"
import type { EventSystem } from "@/systems/eventSystem"
import type { PetSystem } from "@/systems/petSystem"
import type {
  ButlerOpportunity,
} from "@/systems/butler/butler-gateway"

export type RunButlerOpportunityInput = {
  tick: number
  time: TimeState
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  eventSystem: EventSystem
}

type ButlerOpportunityEventInput = {
  tick: number
  time: TimeState
  butlerName: string
  petName: string
  message: string
  narrativeType: NarrativeType
  intensity: number
  opportunityType: string
  accepted?: boolean
  reason?: string
  value?: number
}

function addButlerOpportunityEvent(
  eventSystem: EventSystem,
  input: ButlerOpportunityEventInput
) {
  eventSystem.addInteractionEvent({
    tick: input.tick,
    day: input.time.day,
    hour: input.time.hour,
    petName: input.petName,
    message: input.message,
    narrativeType: input.narrativeType,
    intensity: input.intensity,
    payload: {
      interactionKind: "butler_opportunity",
      opportunityType: input.opportunityType,
      butlerName: input.butlerName,
      accepted: input.accepted,
      reason: input.reason,
      value: input.value,
    },
  })
}

function recordOpportunityFeedback(input: {
  butlerSystem: ButlerSystem
  tick: number
  opportunity: ButlerOpportunity
  accepted: boolean
  reason?: string
  value?: number
}) {
  input.butlerSystem.recordOpportunityFeedback({
    tick: input.tick,
    type: input.opportunity.type,
    accepted: input.accepted,
    reason: input.reason,
    value: input.value,
  })
}

export function runButlerOpportunities(input: RunButlerOpportunityInput) {
  if (!input.petSystem.hasPet()) return

  const pet = input.petSystem.getPet()
  if (!pet) return

  const opportunities = input.butlerSystem.getPendingOpportunities()
  if (opportunities.length === 0) return

  const petName = pet.name
  const butlerName = input.butlerSystem.getState().name

  for (const opportunity of opportunities) {
    if (opportunity.target !== "pet") continue

    if (opportunity.type === "food_offer") {
      const result = input.petSystem.evaluateFoodOffer(opportunity)

      if (result.accepted && result.intakeAmount > 0) {
        input.petSystem.applyAcceptedFoodOffer(result.intakeAmount)

        recordOpportunityFeedback({
          butlerSystem: input.butlerSystem,
          tick: input.tick,
          opportunity,
          accepted: true,
          reason: result.reason,
          value: result.intakeAmount,
        })

        addButlerOpportunityEvent(input.eventSystem, {
          tick: input.tick,
          time: input.time,
          butlerName,
          petName,
          narrativeType: "satisfy_need",
          intensity: Math.min(1, Math.max(0.2, result.intakeAmount / 50)),
          opportunityType: opportunity.type,
          accepted: true,
          reason: result.reason,
          value: result.intakeAmount,
          message:
            `${butlerName}提供了食物。` +
            `${petName}没有被强制进食，而是自主接受了这次机会，` +
            `实际摄食量为 ${result.intakeAmount}。`,
        })
      } else {
        recordOpportunityFeedback({
          butlerSystem: input.butlerSystem,
          tick: input.tick,
          opportunity,
          accepted: false,
          reason: result.reason,
        })

        addButlerOpportunityEvent(input.eventSystem, {
          tick: input.tick,
          time: input.time,
          butlerName,
          petName,
          narrativeType: "keep_distance",
          intensity: 0.45,
          opportunityType: opportunity.type,
          accepted: false,
          reason: result.reason,
          message:
            `${butlerName}提供了食物。` +
            `${petName}感知到了这个机会，但这一次没有接受，` +
            `它仍然保留自己的行动判断。`,
        })
      }

      input.butlerSystem.consumeOpportunity(opportunity.id)
      continue
    }

    if (opportunity.type === "rest_offer") {
      const result = input.petSystem.evaluateRestOffer(opportunity)

      if (result.accepted) {
        const effect = input.petSystem.applyAcceptedRestOffer(opportunity)

        recordOpportunityFeedback({
          butlerSystem: input.butlerSystem,
          tick: input.tick,
          opportunity,
          accepted: true,
          reason: result.reason,
          value: effect.energyDelta,
        })

        addButlerOpportunityEvent(input.eventSystem, {
          tick: input.tick,
          time: input.time,
          butlerName,
          petName,
          narrativeType: "recover",
          intensity: result.intensity,
          opportunityType: opportunity.type,
          accepted: true,
          reason: result.reason,
          value: effect.energyDelta,
          message:
            `${butlerName}整理了更适合恢复的环境。` +
            `${petName}没有被强制休息，而是自主接受了这次恢复机会。` +
            `恢复倾向被轻微强化，精力变化 +${effect.energyDelta}。`,
        })
      } else {
        recordOpportunityFeedback({
          butlerSystem: input.butlerSystem,
          tick: input.tick,
          opportunity,
          accepted: false,
          reason: result.reason,
        })

        addButlerOpportunityEvent(input.eventSystem, {
          tick: input.tick,
          time: input.time,
          butlerName,
          petName,
          narrativeType: "recover",
          intensity: result.intensity,
          opportunityType: opportunity.type,
          accepted: false,
          reason: result.reason,
          message:
            `${butlerName}准备了更适合恢复的环境。` +
            `${petName}已经获得休息机会，但这一次还没有选择停下来。`,
        })
      }

      input.butlerSystem.consumeOpportunity(opportunity.id)
      continue
    }

    if (opportunity.type === "approach_offer") {
      const result = input.petSystem.evaluateApproachOffer(opportunity)

      if (result.accepted) {
        const effect = input.petSystem.applyAcceptedApproachOffer(opportunity)

        recordOpportunityFeedback({
          butlerSystem: input.butlerSystem,
          tick: input.tick,
          opportunity,
          accepted: true,
          reason: result.reason,
        })

        addButlerOpportunityEvent(input.eventSystem, {
          tick: input.tick,
          time: input.time,
          butlerName,
          petName,
          narrativeType: "approach_target",
          intensity: result.intensity,
          opportunityType: opportunity.type,
          accepted: true,
          reason: result.reason,
          message:
            `${butlerName}放慢动作并尝试靠近。` +
            `${petName}没有被命令接近，而是自主回应了这次关系机会。` +
            effect.memorySummary,
        })
      } else {
        recordOpportunityFeedback({
          butlerSystem: input.butlerSystem,
          tick: input.tick,
          opportunity,
          accepted: false,
          reason: result.reason,
        })

        addButlerOpportunityEvent(input.eventSystem, {
          tick: input.tick,
          time: input.time,
          butlerName,
          petName,
          narrativeType: "keep_distance",
          intensity: result.intensity,
          opportunityType: opportunity.type,
          accepted: false,
          reason: result.reason,
          message:
            `${butlerName}尝试靠近。` +
            `${petName}没有立刻回应，它仍然在保留自己的距离边界。`,
        })
      }

      input.butlerSystem.consumeOpportunity(opportunity.id)
    }
  }

  const latestPet = input.petSystem.getPet()

  if (
    latestPet &&
    latestPet.action === "sleeping" &&
    (latestPet.timelineSnapshot?.state.physical.energy ?? latestPet.energy) < 100
  ) {
    input.eventSystem.addInteractionEvent({
      tick: input.tick,
      day: input.time.day,
      hour: input.time.hour,
      petName: latestPet.name,
      message:
        `${latestPet.name}正在休息，精力正在缓慢恢复。` +
        "这不是管家的直接控制，而是它当前状态下的自主恢复过程。",
      narrativeType: "recover",
      intensity: 0.5,
      payload: {
        interactionKind: "pet_recovery",
        accepted: true,
      },
    })
  }
}