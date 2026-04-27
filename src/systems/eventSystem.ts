/**
 * 当前文件负责：维护世界事件列表，并调度时间、宠物与孵化器事件生成。
 */

import type { WorldEvent } from "../types/event"

import {
  buildIncubatorEvents,
  buildPetUpdateEvents,
  buildTimePeriodEvents,
  makeWorldEvent,
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
    this.events.push(
      ...buildTimePeriodEvents({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        prevPeriod: input.prevPeriod,
        currentPeriod: input.currentPeriod,
      })
    )

    if (input.prevPet && input.currentPet) {
      this.events.push(
        ...buildPetUpdateEvents({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
          prevPet: input.prevPet as PetStateLike,
          currentPet: input.currentPet as PetStateLike,
          continuityByPetKey: this.continuityByPetKey,
        })
      )
    }

    this.events.push(
      ...buildIncubatorEvents({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        prevIncubator: input.prevIncubator,
        currentIncubator: input.currentIncubator,
      })
    )
  }
}

export default EventSystem