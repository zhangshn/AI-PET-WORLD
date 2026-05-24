/**
 * 当前文件职责：根据家园状态、空间和设施推导家园生命周期阶段。
 */

import type {
  HomeFacilityState,
  HomeLifecyclePhase,
  HomeLifecycleState,
  HomeSpaceState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { syncHomeFacilities } from "./home-facility-runner"
import { syncHomeSpaces } from "./home-space-runner"

function hasActiveFacility(
  facilities: HomeFacilityState[],
  id: HomeFacilityState["id"]
): boolean {
  return facilities.some(
    (facility) =>
      facility.id === id &&
      (facility.status === "active" || facility.status === "needs_maintenance")
  )
}

function hasUsableSpace(
  spaces: HomeSpaceState[],
  id: HomeSpaceState["id"]
): boolean {
  return spaces.some(
    (space) =>
      space.id === id &&
      (space.status === "active" || space.status === "available")
  )
}

function resolvePhase(input: {
  home: HomeState
  spaces: HomeSpaceState[]
  facilities: HomeFacilityState[]
}): HomeLifecyclePhase {
  const { home, spaces, facilities } = input

  if (
    home.status === "completed" &&
    home.progress >= 100 &&
    hasUsableSpace(spaces, "activity_area")
  ) {
    return "stable_home_phase"
  }

  if (
    home.gardenProgress >= 35 ||
    hasUsableSpace(spaces, "garden_area") ||
    hasActiveFacility(facilities, "garden_patch")
  ) {
    return "garden_opening_phase"
  }

  if (
    home.progress >= 55 ||
    hasActiveFacility(facilities, "shelter_bed") ||
    hasActiveFacility(facilities, "food_corner") ||
    hasActiveFacility(facilities, "water_corner")
  ) {
    return "basic_living_phase"
  }

  if (
    home.progress >= 15 ||
    hasUsableSpace(spaces, "temporary_shelter")
  ) {
    return "temporary_shelter_phase"
  }

  if (hasActiveFacility(facilities, "basic_care_station")) {
    return "initial_care_phase"
  }

  return "initial_empty_land"
}

function resolvePhaseProgress(input: {
  phase: HomeLifecyclePhase
  home: HomeState
}): number {
  const { phase, home } = input

  if (phase === "initial_empty_land") {
    return clamp(Math.min(100, home.progress * 2))
  }

  if (phase === "initial_care_phase") {
    return clamp(Math.max(20, home.progress * 2.5))
  }

  if (phase === "temporary_shelter_phase") {
    return clamp(home.progress)
  }

  if (phase === "basic_living_phase") {
    return clamp(Math.max(35, home.progress))
  }

  if (phase === "garden_opening_phase") {
    return clamp(Math.max(home.gardenProgress, home.progress * 0.85))
  }

  if (phase === "stable_home_phase") {
    return 100
  }

  return 0
}

function resolveGoalText(phase: HomeLifecyclePhase): {
  mainGoal: string
  nextGoal: string
  summary: string
} {
  if (phase === "initial_empty_land") {
    return {
      mainGoal: "确认初始空地与世界边界。",
      nextGoal: "稳定初始照护区，并开始整理临时住所。",
      summary: "家园仍处于最初的空地阶段，管家正在确认最基础的秩序。",
    }
  }

  if (phase === "initial_care_phase") {
    return {
      mainGoal: "优先维持初始照护区稳定。",
      nextGoal: "在保持基础照护与管理秩序的前提下推进临时住所。",
      summary: "当前家园的核心是初始照护与基础管理，管家会优先保证世界运行稳定。",
    }
  }

  if (phase === "temporary_shelter_phase") {
    return {
      mainGoal: "搭建可遮蔽和可整理的临时住所。",
      nextGoal: "补齐基础休息、食物和饮水设施。",
      summary: "家园正在从空地过渡到临时住所，管家开始建立基础生活秩序。",
    }
  }

  if (phase === "basic_living_phase") {
    return {
      mainGoal: "形成基础生活支持能力。",
      nextGoal: "开放庭院和更多可活动空间。",
      summary: "家园已经具备初步生活支持，后续会逐步扩展到庭院与活动空间。",
    }
  }

  if (phase === "garden_opening_phase") {
    return {
      mainGoal: "开放庭院区域并增强可观察空间。",
      nextGoal: "形成更稳定的家园结构。",
      summary: "庭院和活动空间开始出现，家园正从住所成长为可观察、可活动的环境。",
    }
  }

  return {
    mainGoal: "维持稳定家园状态。",
    nextGoal: "为后续医院、公园和小镇扩展预留空间。",
    summary: "家园主体已经稳定，后续可以承接更复杂的设施与世界扩展。",
  }
}

export function resolveHomeLifecycle(home: HomeState): HomeLifecycleState {
  const spaces = syncHomeSpaces(home)
  const facilities = syncHomeFacilities({
    ...home,
    homeSpaces: spaces,
  })

  const phase = resolvePhase({
    home,
    spaces,
    facilities,
  })
  const goal = resolveGoalText(phase)
  const phaseProgress = resolvePhaseProgress({ phase, home })

  const canSupportPetRest =
    hasActiveFacility(facilities, "shelter_bed") ||
    phase === "basic_living_phase" ||
    phase === "garden_opening_phase" ||
    phase === "stable_home_phase"

  const canSupportFoodRoutine =
    hasActiveFacility(facilities, "food_corner") ||
    hasActiveFacility(facilities, "water_corner") ||
    phase === "basic_living_phase" ||
    phase === "garden_opening_phase" ||
    phase === "stable_home_phase"

  const canSupportGardenActivity =
    hasUsableSpace(spaces, "garden_area") ||
    hasActiveFacility(facilities, "garden_patch") ||
    phase === "garden_opening_phase" ||
    phase === "stable_home_phase"

  const canSupportPetExploration =
    hasUsableSpace(spaces, "activity_area") ||
    hasActiveFacility(facilities, "observation_spot") ||
    canSupportGardenActivity

  return {
    phase,
    phaseProgress,
    mainGoal: goal.mainGoal,
    nextGoal: goal.nextGoal,
    canSupportPetExploration,
    canSupportPetRest,
    canSupportFoodRoutine,
    canSupportGardenActivity,
    summary: goal.summary,
    tags: Array.from(new Set([
      "home_lifecycle",
      `phase_${phase}`,
      canSupportPetRest ? "supports_future_adoption_pet_recovery" : "no_future_adoption_pet_recovery_support",
      canSupportFoodRoutine ? "supports_food_routine" : "no_food_routine_support",
      canSupportGardenActivity ? "supports_garden_activity" : "no_garden_activity",
      canSupportPetExploration ? "supports_future_adoption_pet_exploration" : "no_future_adoption_pet_exploration_support",
    ])),
  }
}
