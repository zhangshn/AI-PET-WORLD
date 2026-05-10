/**
 * 当前文件负责：把家园设施效果汇总到家园整体状态。
 *
 * 注意：
 * 设施效果只影响 HomeState 的整体环境数值。
 * 不直接控制宠物行为。
 * 不写宠物 learning。
 */

import type {
  HomeFacilityState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { syncHomeFacilities } from "./home-facility-runner"
import { syncHomeSpaces } from "./home-space-runner"
import { buildHomeSpaceSummary } from "./home-space-summary-runner"

export type HomeFacilityEffectSummary = {
  comfortDelta: number
  stabilityDelta: number
  expansionDelta: number
  gardenDelta: number
  activeFacilityCount: number
  maintenanceFacilityCount: number
  tags: string[]
}

function roundDelta(value: number): number {
  return Math.round(value * 100) / 100
}

function getFacilityEffectFactor(facility: HomeFacilityState): number {
  if (facility.status === "active") {
    return Math.max(0.15, Math.min(1, facility.usefulness / 100))
  }

  if (facility.status === "needs_maintenance") {
    return -0.35
  }

  if (facility.status === "building") {
    return 0.08
  }

  return 0
}

export function summarizeHomeFacilityEffects(
  home: HomeState
): HomeFacilityEffectSummary {
  const facilities = syncHomeFacilities(home)

  let comfortDelta = 0
  let stabilityDelta = 0
  let expansionDelta = 0
  let gardenDelta = 0
  let activeFacilityCount = 0
  let maintenanceFacilityCount = 0
  const tags: string[] = ["home_facility_effect"]

  facilities.forEach((facility) => {
    const factor = getFacilityEffectFactor(facility)

    if (facility.status === "active") {
      activeFacilityCount += 1
    }

    if (facility.status === "needs_maintenance") {
      maintenanceFacilityCount += 1
      tags.push(`needs_maintenance_${facility.id}`)
    }

    comfortDelta += facility.comfortBonus * factor * 0.03
    stabilityDelta += facility.stabilityBonus * factor * 0.03
    expansionDelta += facility.activityBonus * factor * 0.02

    if (facility.role === "garden") {
      gardenDelta += facility.usefulness * factor * 0.01
    }

    if (facility.role === "observation") {
      expansionDelta += facility.usefulness * factor * 0.006
    }

    tags.push(`facility_${facility.id}_${facility.status}`)
  })

  return {
    comfortDelta: roundDelta(comfortDelta),
    stabilityDelta: roundDelta(stabilityDelta),
    expansionDelta: roundDelta(expansionDelta),
    gardenDelta: roundDelta(gardenDelta),
    activeFacilityCount,
    maintenanceFacilityCount,
    tags: Array.from(new Set(tags)).slice(0, 40),
  }
}

export function applyHomeFacilityEffects(home: HomeState): HomeState {
  const homeWithSpaces: HomeState = {
    ...home,
    homeSpaces: syncHomeSpaces(home),
  }

  const homeWithFacilities: HomeState = {
    ...homeWithSpaces,
    homeFacilities: syncHomeFacilities(homeWithSpaces),
  }

  const effect = summarizeHomeFacilityEffects(homeWithFacilities)

  const nextHome: HomeState = {
    ...homeWithFacilities,
    comfort: clamp(homeWithFacilities.comfort + effect.comfortDelta),
    stability: clamp(homeWithFacilities.stability + effect.stabilityDelta),
    expansion: clamp(homeWithFacilities.expansion + effect.expansionDelta),
    gardenProgress: clamp(
      homeWithFacilities.gardenProgress + effect.gardenDelta
    ),
  }

  return {
    ...nextHome,
    homeSpaces: syncHomeSpaces(nextHome),
    homeFacilities: syncHomeFacilities(nextHome),
    spaceSummary: buildHomeSpaceSummary(nextHome),
  }
}
