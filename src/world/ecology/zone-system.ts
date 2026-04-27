/**
 * 当前文件负责：创建并维护第一版世界功能区域。
 */

import type { WorldZone } from "./world-zone-types"

export function createDefaultWorldZones(): WorldZone[] {
  return [
    {
      id: "zone-sleep-01",
      type: "sleep_zone",
      name: "睡眠区",
      x: 690,
      y: 365,
      radius: 58,
      effect: {
        comfortBonus: 18,
        safetyBonus: 16,
        curiosityBonus: -8,
        restBonus: 24,
        stressModifier: -14,
      },
      isActive: true,
    },
    {
      id: "zone-food-01",
      type: "food_zone",
      name: "进食区",
      x: 445,
      y: 355,
      radius: 48,
      effect: {
        comfortBonus: 8,
        safetyBonus: 6,
        curiosityBonus: -4,
        restBonus: 2,
        stressModifier: -4,
      },
      isActive: true,
    },
    {
      id: "zone-warm-01",
      type: "warm_zone",
      name: "温暖角落",
      x: 650,
      y: 335,
      radius: 66,
      effect: {
        comfortBonus: 22,
        safetyBonus: 12,
        curiosityBonus: -2,
        restBonus: 14,
        stressModifier: -16,
      },
      isActive: true,
    },
    {
      id: "zone-quiet-01",
      type: "quiet_zone",
      name: "安静区域",
      x: 610,
      y: 295,
      radius: 72,
      effect: {
        comfortBonus: 12,
        safetyBonus: 10,
        curiosityBonus: 2,
        restBonus: 18,
        stressModifier: -18,
      },
      isActive: true,
    },
    {
      id: "zone-observe-01",
      type: "observation_zone",
      name: "观察区",
      x: 560,
      y: 265,
      radius: 62,
      effect: {
        comfortBonus: 2,
        safetyBonus: 4,
        curiosityBonus: 20,
        restBonus: -4,
        stressModifier: 2,
      },
      isActive: true,
    },
    {
      id: "zone-incubator-01",
      type: "incubator_zone",
      name: "孵化器工作区",
      x: 330,
      y: 255,
      radius: 64,
      effect: {
        comfortBonus: 6,
        safetyBonus: 16,
        curiosityBonus: 4,
        restBonus: 0,
        stressModifier: -4,
      },
      isActive: true,
    },
    {
      id: "zone-home-build-01",
      type: "home_build_zone",
      name: "家园建造区",
      x: 570,
      y: 310,
      radius: 78,
      effect: {
        comfortBonus: 4,
        safetyBonus: 8,
        curiosityBonus: 10,
        restBonus: -2,
        stressModifier: 0,
      },
      isActive: true,
    },
    {
      id: "zone-explore-01",
      type: "exploration_zone",
      name: "探索区",
      x: 760,
      y: 255,
      radius: 96,
      effect: {
        comfortBonus: -2,
        safetyBonus: -4,
        curiosityBonus: 24,
        restBonus: -10,
        stressModifier: 6,
      },
      isActive: true,
    },
  ]
}

export function findNearestWorldZone(input: {
  zones: WorldZone[]
  x: number
  y: number
  type?: WorldZone["type"]
}): WorldZone | null {
  const candidates = input.zones.filter((zone) => {
    if (!zone.isActive) return false
    if (input.type && zone.type !== input.type) return false
    return true
  })

  if (candidates.length === 0) {
    return null
  }

  let nearest = candidates[0]
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const zone of candidates) {
    const dx = zone.x - input.x
    const dy = zone.y - input.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < nearestDistance) {
      nearest = zone
      nearestDistance = distance
    }
  }

  return nearest
}