/**
 * 当前文件负责：创建、清理与判断管家提供给宠物的自主机会。
 */

import type {
  ButlerOpportunity,
  ButlerOpportunityType,
} from "./butler-schema"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function buildOpportunityId(
  type: ButlerOpportunityType,
  tick: number
): string {
  return `butler-${type}-${tick}`
}

export function createFoodOffer(
  tick: number,
  portion: number
): ButlerOpportunity {
  const safePortion = clamp(portion, 1, 100)

  return {
    id: buildOpportunityId("food_offer", tick),
    type: "food_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 3,
    createdBy: "butler",
    target: "pet",
    summary: "管家提供了可被宠物自主决定是否接受的食物机会。",
    intensity: safePortion,
    payload: {
      foodPortion: safePortion,
    },
  }
}

export function createRestOffer(
  tick: number,
  comfortLevel: number
): ButlerOpportunity {
  const safeComfort = clamp(comfortLevel, 1, 100)

  return {
    id: buildOpportunityId("rest_offer", tick),
    type: "rest_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 4,
    createdBy: "butler",
    target: "pet",
    summary: "管家整理了恢复环境，给宠物提供休息机会。",
    intensity: safeComfort,
    payload: {
      comfortLevel: safeComfort,
    },
  }
}

export function createApproachOffer(
  tick: number,
  socialWarmth: number
): ButlerOpportunity {
  const safeWarmth = clamp(socialWarmth, 1, 100)

  return {
    id: buildOpportunityId("approach_offer", tick),
    type: "approach_offer",
    createdAtTick: tick,
    expiresAtTick: tick + 2,
    createdBy: "butler",
    target: "pet",
    summary: "管家发起了一次可被宠物自主回应的关系接近机会。",
    intensity: safeWarmth,
    payload: {
      socialWarmth: safeWarmth,
    },
  }
}

export function removeExpiredOpportunities(
  opportunities: ButlerOpportunity[],
  tick: number
): ButlerOpportunity[] {
  return opportunities.filter((item) => item.expiresAtTick >= tick)
}

export function hasPendingOpportunity(
  opportunities: ButlerOpportunity[],
  type: ButlerOpportunityType
): boolean {
  return opportunities.some((item) => item.type === type)
}