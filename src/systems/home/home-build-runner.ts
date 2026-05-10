/**
 * 当前文件负责：根据建造投入与人格行为偏置推进家园状态。
 */

import type { GenderAwareBehaviorBias } from "@/ai/gateway"
import type { HomeState } from "@/types/home"
import { resolveEvolutionFocus } from "./home-evolution-runner"
import { resolveConstructionStage } from "./home-stage-runner"
import { applyHomeFacilityEffects } from "./home-facility-effect-runner"
import { syncHomeFacilities } from "./home-facility-runner"
import { buildHomeSpaceSummary } from "./home-space-summary-runner"
import { syncHomeSpaces } from "./home-space-runner"
import { clamp } from "./home-utils"

export type BuildHomeInput = {
  home: HomeState
  amount: number
  behaviorBias?: GenderAwareBehaviorBias | null
}

function syncHomeDerivedState(home: HomeState): HomeState {
  const homeWithSpaces: HomeState = {
    ...home,
    homeSpaces: syncHomeSpaces(home),
  }

  const homeWithFacilities: HomeState = {
    ...homeWithSpaces,
    homeFacilities: syncHomeFacilities(homeWithSpaces),
  }

  const homeWithFacilityEffects = applyHomeFacilityEffects(homeWithFacilities)

  return {
    ...homeWithFacilityEffects,
    spaceSummary: buildHomeSpaceSummary(homeWithFacilityEffects),
  }
}

export function buildHome(input: BuildHomeInput): HomeState {
  const nextHome: HomeState = { ...input.home }

  if (nextHome.status === "completed") {
    return syncHomeDerivedState(nextHome)
  }

  const building = input.behaviorBias?.buildingBias

  const constructionBonus = building
    ? (building.stabilityPreference + building.orderPreference) / 200
    : 0.25

  const finalAmount = input.amount * (1 + constructionBonus * 0.35)

  nextHome.progress = clamp(nextHome.progress + finalAmount)
  nextHome.evolutionFocus = resolveEvolutionFocus(input.behaviorBias)
  nextHome.constructionStage = resolveConstructionStage(nextHome.progress)

  if (building) {
    nextHome.comfort = clamp(
      nextHome.comfort + building.comfortPreference * 0.015
    )
    nextHome.stability = clamp(
      nextHome.stability + building.stabilityPreference * 0.015
    )
    nextHome.expansion = clamp(
      nextHome.expansion + building.expansionPreference * 0.015
    )
    nextHome.gardenProgress = clamp(
      nextHome.gardenProgress + building.adaptabilityPreference * 0.012
    )
  } else {
    nextHome.comfort = clamp(nextHome.comfort + 0.3)
    nextHome.stability = clamp(nextHome.stability + 0.3)
    nextHome.gardenProgress = clamp(nextHome.gardenProgress + 0.2)
  }

  if (nextHome.progress > 0 && nextHome.progress < 100) {
    nextHome.status = "building"
  }

  if (nextHome.progress >= 100) {
    nextHome.progress = 100
    nextHome.status = "completed"
    nextHome.constructionStage = "completed"
    nextHome.level = Math.max(nextHome.level, 2)
  }

  return syncHomeDerivedState(nextHome)
}
