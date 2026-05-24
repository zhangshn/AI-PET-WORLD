/**
 * 当前文件负责：维护世界事件历史，并生成每个 Tick 的世界事件。
 */

import type { WorldEvent } from "../types/event"
import { recordWorldEventForAiData } from "./event/event-ai-recorder"

import {
  buildPetUpdateEvents,
  buildTimePeriodEvents,
  makeWorldEvent,
  type ContinuityState,
  type EventSystemUpdateInput,
  type InteractionEventInput,
  type PetAdoptionAppliedEventInput,
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

  restore(events: WorldEvent[]): void {
    this.events = events.slice(-MAX_EVENT_HISTORY)
    this.continuityByPetKey = new Map<string, ContinuityState>()
    this.dedupeRunner = new EventDedupeRunner()
  }

  private appendEvents(nextEvents: WorldEvent[]): void {
    if (nextEvents.length === 0) return

    const filteredEvents = nextEvents.filter((event) =>
      this.dedupeRunner.shouldKeepEvent(event)
    )

    if (filteredEvents.length === 0) return

    filteredEvents.forEach((event) => {
      recordWorldEventForAiData(event)
    })

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

  addPetAdoptionAppliedEvent(input: PetAdoptionAppliedEventInput): void {
    const event = makeWorldEvent({
      tick: input.tick,
      day: input.day,
      hour: input.hour,
      type: "pet_adoption_applied",
      petName: input.petName,
      message: `${input.petName} has entered the home after adoption review and safe apply.`,
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

  }
}

export default EventSystem
