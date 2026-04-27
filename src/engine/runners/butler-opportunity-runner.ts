/**
 * 当前文件负责：处理管家对宠物产生的机会事件，并把结果写入宠物系统与事件系统。
 */

import type { TimeState } from "../timeSystem"
import type { ButlerSystem } from "@/systems/butlerSystem"
import type { EventSystem } from "@/systems/eventSystem"
import type { PetSystem } from "@/systems/petSystem"

export type RunButlerOpportunityInput = {
  tick: number
  time: TimeState
  petSystem: PetSystem
  butlerSystem: ButlerSystem
  eventSystem: EventSystem
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

        input.eventSystem.addInteractionEvent({
          tick: input.tick,
          day: input.time.day,
          hour: input.time.hour,
          message: `${butlerName}提供了食物，${petName}自主决定进食，实际摄食量为 ${result.intakeAmount}（${result.reason}）。`,
        })
      } else {
        input.eventSystem.addInteractionEvent({
          tick: input.tick,
          day: input.time.day,
          hour: input.time.hour,
          message: `${butlerName}提供了食物，但${petName}这次没有接受（${result.reason}）。`,
        })
      }

      input.butlerSystem.consumeOpportunity(opportunity.id)
      continue
    }

    if (opportunity.type === "rest_offer") {
      const currentPet = input.petSystem.getPet()

      if (
        currentPet &&
        (currentPet.action === "resting" || currentPet.action === "sleeping")
      ) {
        input.eventSystem.addInteractionEvent({
          tick: input.tick,
          day: input.time.day,
          hour: input.time.hour,
          message: `${butlerName}整理了恢复环境，${petName}当前正在自主休息。`,
        })
      } else {
        input.eventSystem.addInteractionEvent({
          tick: input.tick,
          day: input.time.day,
          hour: input.time.hour,
          message: `${butlerName}准备了更适合恢复的环境，但${petName}是否进入休息仍由自己决定。`,
        })
      }

      input.butlerSystem.consumeOpportunity(opportunity.id)
      continue
    }

    if (opportunity.type === "approach_offer") {
      const currentPet = input.petSystem.getPet()

      if (currentPet && currentPet.action === "approaching") {
        input.eventSystem.addInteractionEvent({
          tick: input.tick,
          day: input.time.day,
          hour: input.time.hour,
          message: `${butlerName}发起了接近，${petName}当前表现出接受接近的倾向。`,
        })
      } else {
        input.eventSystem.addInteractionEvent({
          tick: input.tick,
          day: input.time.day,
          hour: input.time.hour,
          message: `${butlerName}试图靠近，但${petName}是否回应仍由自己决定。`,
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
      message: `${latestPet.name}正在休息，精力正在恢复。`,
    })
  }
}