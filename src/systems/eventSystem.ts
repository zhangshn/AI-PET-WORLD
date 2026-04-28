/**
 * Current file responsibility:
 * maintain world event history and generate per-tick updates.
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

const MAX_EVENT_HISTORY = 200

export class EventSystem {
  private events: WorldEvent[] = []
  private continuityByPetKey = new Map<string, ContinuityState>()

  getEvents(): WorldEvent[] {
    return [...this.events]
  }

  private appendEvents(nextEvents: WorldEvent[]): void {
    if (nextEvents.length === 0) return

    this.events.push(...nextEvents)

    if (this.events.length > MAX_EVENT_HISTORY) {
      this.events.splice(0, this.events.length - MAX_EVENT_HISTORY)
    }
  }

  addInteractionEvent(input: InteractionEventInput): void {
    const event = makeWorldEvent({
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "interaction",
      message: input.message,
    })

    this.appendEvents([event])
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

    this.appendEvents([event])
  }

  update(input: EventSystemUpdateInput): void {
    this.appendEvents(
      buildTimePeriodEvents({
        tick: input.tick,
        day: input.day,
        hour: input.hour,
        prevPeriod: input.prevPeriod,
        currentPeriod: input.currentPeriod,
      })
    )

    if (input.prevPet && input.currentPet) {
      this.appendEvents(
        buildPetUpdateEvents({
          tick: input.tick,
          day: input.day,
          hour: input.hour,
          prevPet: input.prevPet as PetStateLike,
          currentPet: input.currentPet as PetStateLike,
          continuityByPetKey: this.continuityByPetKey,
        })
      )
    }

    this.appendEvents(
      buildIncubatorEvents({
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
