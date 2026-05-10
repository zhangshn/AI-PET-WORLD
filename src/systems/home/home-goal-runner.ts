/**
 * 当前文件负责：根据家园生命周期、空间与设施生成家园目标。
 *
 * 注意：
 * 家园目标只为管家和世界运行层提供方向。
 * 不直接控制宠物行为。
 */

import type {
  HomeFacilityState,
  HomeGoalPriority,
  HomeGoalState,
  HomeLifecyclePhase,
  HomeSpaceState,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { syncHomeFacilities } from "./home-facility-runner"
import { resolveHomeLifecycle } from "./home-lifecycle-runner"
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

function getFacilityProgress(
  facilities: HomeFacilityState[],
  id: HomeFacilityState["id"]
): number {
  return facilities.find((facility) => facility.id === id)?.progress ?? 0
}

function getWeakFacilityCount(facilities: HomeFacilityState[]): number {
  return facilities.filter(
    (facility) =>
      facility.status === "needs_maintenance" ||
      (facility.status === "active" && facility.durability < 35)
  ).length
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

function priorityFromPhase(
  phase: HomeLifecyclePhase,
  goalPhase: HomeLifecyclePhase
): HomeGoalPriority {
  if (phase === goalPhase) return "high"

  return "medium"
}

function sortGoals(goals: HomeGoalState[]): HomeGoalState[] {
  const weight: Record<HomeGoalPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  }

  return [...goals].sort((a, b) => {
    const priorityDiff = weight[b.priority] - weight[a.priority]

    if (priorityDiff !== 0) return priorityDiff

    return a.progress - b.progress
  })
}

export function buildHomeGoals(home: HomeState): HomeGoalState[] {
  const spaces = syncHomeSpaces(home)
  const facilities = syncHomeFacilities({
    ...home,
    homeSpaces: spaces,
  })
  const lifecycle = home.lifecycle ?? resolveHomeLifecycle({
    ...home,
    homeSpaces: spaces,
    homeFacilities: facilities,
  })

  const goals: HomeGoalState[] = []

  const weakFacilityCount = getWeakFacilityCount(facilities)

  goals.push({
    id: "stabilize_incubator",
    priority:
      lifecycle.phase === "incubator_care_phase" ? "urgent" : "medium",
    target: "incubator",
    progress: clamp(
      hasActiveFacility(facilities, "basic_incubator")
        ? 100
        : getFacilityProgress(facilities, "basic_incubator")
    ),
    title: "稳定孵化器区域",
    description: "保持孵化器区域和基础孵化设施稳定。",
    reason: "新世界早期需要优先保障胚胎环境。",
    recommendedBehaviorKinds: ["incubator_watch", "home_maintenance"],
    tags: ["home_goal", "incubator", `phase_${lifecycle.phase}`],
  })

  goals.push({
    id: "build_temporary_shelter",
    priority: priorityFromPhase(
      lifecycle.phase,
      "temporary_shelter_phase"
    ),
    target: "space",
    progress: clamp(home.progress),
    title: "推进临时住所",
    description: "继续搭建最初的住所结构，为后续生活设施提供基础。",
    reason: "家园需要从空地过渡到可遮蔽、可整理的基础住所。",
    recommendedBehaviorKinds: ["home_building", "space_tidying"],
    tags: ["home_goal", "temporary_shelter", `phase_${lifecycle.phase}`],
  })

  goals.push({
    id: "complete_basic_living",
    priority:
      lifecycle.phase === "basic_living_phase" ? "high" : "medium",
    target: "facility",
    progress: clamp(
      (
        getFacilityProgress(facilities, "shelter_bed") +
        getFacilityProgress(facilities, "food_corner") +
        getFacilityProgress(facilities, "water_corner")
      ) / 3
    ),
    title: "补齐基础生活设施",
    description: "推进休息、食物和饮水相关设施，让家园具备基础生活支持。",
    reason: "基础生活设施是宠物出生后稳定观察和休息的前提。",
    recommendedBehaviorKinds: ["home_building", "home_maintenance"],
    tags: ["home_goal", "basic_living", `phase_${lifecycle.phase}`],
  })

  goals.push({
    id: "open_garden_area",
    priority:
      lifecycle.phase === "garden_opening_phase" ? "high" : "low",
    target: "space",
    progress: clamp(
      Math.max(
        home.gardenProgress,
        getFacilityProgress(facilities, "garden_patch")
      )
    ),
    title: "开放庭院区域",
    description: "推进庭院和观察类空间，为后续探索、观察与世界扩展预留空间。",
    reason: "庭院是家园从临时住所走向开放空间的重要阶段。",
    recommendedBehaviorKinds: ["home_building", "space_tidying"],
    tags: ["home_goal", "garden", `phase_${lifecycle.phase}`],
  })

  goals.push({
    id: "maintain_home_facilities",
    priority: weakFacilityCount > 0 ? "urgent" : "low",
    target: "facility",
    progress: clamp(100 - weakFacilityCount * 18),
    title: "维护家园设施",
    description: "修复耐久度较低或需要维护的设施。",
    reason:
      weakFacilityCount > 0
        ? "已有设施出现维护需求。"
        : "当前设施状态尚可，只需保持轻量维护。",
    recommendedBehaviorKinds: ["home_maintenance", "space_tidying"],
    tags: [
      "home_goal",
      "maintenance",
      `weak_facilities_${weakFacilityCount}`,
      `phase_${lifecycle.phase}`,
    ],
  })

  goals.push({
    id: "prepare_future_expansion",
    priority:
      lifecycle.phase === "stable_home_phase" ? "medium" : "low",
    target: "future_world",
    progress: clamp(
      hasUsableSpace(spaces, "activity_area") ? home.expansion : home.progress * 0.4
    ),
    title: "预留未来扩展",
    description: "为未来医院、公园、小镇等空间扩展保留世界结构余量。",
    reason: "稳定家园之后，世界需要具备继续扩展的空间基础。",
    recommendedBehaviorKinds: ["space_tidying", "world_state_explanation"],
    tags: ["home_goal", "future_expansion", `phase_${lifecycle.phase}`],
  })

  return sortGoals(goals)
}
