/**
 * 当前文件负责：维护世界事件历史，并生成每个 Tick 的世界事件。
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

import { EventDedupeRunner } from "./event/event-dedupe-runner"

const MAX_EVENT_HISTORY = 200

export class EventSystem {
  private events: WorldEvent[] = []
  private continuityByPetKey = new Map<string, ContinuityState>()
  private dedupeRunner = new EventDedupeRunner()

  getEvents(): WorldEvent[] {
    return [...this.events]
  }

  private appendEvents(nextEvents: WorldEvent[]): void {
    if (nextEvents.length === 0) return

    const filteredEvents = nextEvents.filter((event) =>
      this.dedupeRunner.shouldKeepEvent(event)
    )

    if (filteredEvents.length === 0) return

    this.events.push(...filteredEvents)

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
      petName: input.petName,
      message: input.message,
      sourceAction: input.sourceAction,
      narrativeType: input.narrativeType,
      intensity: input.intensity,
      payload: input.payload,
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