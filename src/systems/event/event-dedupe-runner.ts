/**
 * 当前文件负责：判断世界事件是否需要进入事件历史，避免低价值 interaction 刷屏。
 */

import type { WorldEvent } from "@/types/event"

const SIMILAR_INTERACTION_COOLDOWN_TICKS = 3
const RECOVERY_EVENT_COOLDOWN_TICKS = 4
const BUTLER_OPPORTUNITY_COOLDOWN_TICKS = 3

export class EventDedupeRunner {
  private lastInteractionTickByKey = new Map<string, number>()

  shouldKeepEvent(event: WorldEvent): boolean {
    if (event.type !== "interaction") {
      return true
    }

    const dedupeKey = this.buildInteractionDedupeKey(event)
    const lastTick = this.lastInteractionTickByKey.get(dedupeKey)

    if (typeof lastTick === "number") {
      const cooldownTicks = this.getInteractionCooldownTicks(event)

      if (event.tick - lastTick < cooldownTicks) {
        return false
      }
    }

    this.lastInteractionTickByKey.set(dedupeKey, event.tick)
    this.trim(event.tick)

    return true
  }

  private buildInteractionDedupeKey(event: WorldEvent): string {
    const interactionKind = event.payload?.interactionKind
    const opportunityType = event.payload?.opportunityType
    const accepted = event.payload?.accepted
    const petName = event.petName ?? ""
    const narrativeType = event.narrativeType ?? ""
    const sourceAction = event.sourceAction ?? ""

    return [
      event.type,
      interactionKind ?? "",
      opportunityType ?? "",
      accepted ?? "",
      petName,
      narrativeType,
      sourceAction,
    ].join("::")
  }

  private getInteractionCooldownTicks(event: WorldEvent): number {
    const interactionKind = event.payload?.interactionKind

    if (interactionKind === "pet_recovery") {
      return RECOVERY_EVENT_COOLDOWN_TICKS
    }

    if (interactionKind === "butler_opportunity") {
      return BUTLER_OPPORTUNITY_COOLDOWN_TICKS
    }

    return SIMILAR_INTERACTION_COOLDOWN_TICKS
  }

  private trim(currentTick: number): void {
    const maxCooldown = Math.max(
      SIMILAR_INTERACTION_COOLDOWN_TICKS,
      RECOVERY_EVENT_COOLDOWN_TICKS,
      BUTLER_OPPORTUNITY_COOLDOWN_TICKS
    )

    for (const [key, tick] of this.lastInteractionTickByKey.entries()) {
      if (currentTick - tick > maxCooldown * 4) {
        this.lastInteractionTickByKey.delete(key)
      }
    }
  }
}