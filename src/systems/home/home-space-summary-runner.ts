/**
 * 当前文件负责：根据家园空间实体生成家园空间摘要。
 */

import type {
  HomeSpaceId,
  HomeSpaceState,
  HomeSpaceSummary,
  HomeState,
} from "@/types/home"

import { clamp } from "./home-utils"
import { syncHomeSpaces } from "./home-space-runner"

function average(values: number[]): number {
  if (values.length === 0) return 0

  return clamp(
    values.reduce((sum, value) => sum + value, 0) / values.length
  )
}

function getSpaceIds(
  spaces: HomeSpaceState[],
  predicate: (space: HomeSpaceState) => boolean
): HomeSpaceId[] {
  return spaces.filter(predicate).map((space) => space.id)
}

function scorePrimarySpace(space: HomeSpaceState): number {
  let score = 0

  if (space.status === "active") score += 60
  if (space.status === "building") score += 40
  if (space.status === "available") score += 30
  if (space.status === "locked") score -= 100

  score += space.progress * 0.25
  score += space.activity * 0.2
  score += space.comfort * 0.15
  score += space.stability * 0.15
  score -= space.order * 0.2

  return score
}

function resolvePrimarySpace(spaces: HomeSpaceState[]): HomeSpaceState {
  const ranked = [...spaces].sort(
    (a, b) => scorePrimarySpace(b) - scorePrimarySpace(a)
  )

  return ranked[0] ?? {
    id: "empty_land",
    name: "初始空地",
    role: "origin",
    status: "active",
    order: 1,
    progress: 100,
    comfort: 20,
    stability: 35,
    activity: 10,
    description: "世界最初展开的空地。",
    tags: ["origin", "fallback"],
  }
}

function buildSummaryText(input: {
  home: HomeState
  primarySpace: HomeSpaceState
  buildingSpaceIds: HomeSpaceId[]
  activeSpaceIds: HomeSpaceId[]
}): string {
  if (input.home.status === "completed") {
    return `家园主体已经完成，当前核心空间是${input.primarySpace.name}。`
  }

  if (input.buildingSpaceIds.length > 0) {
    return `家园仍在成长中，当前主要推进${input.primarySpace.name}。`
  }

  if (input.activeSpaceIds.length > 0) {
    return `家园已经有可稳定使用的空间，当前核心区域是${input.primarySpace.name}。`
  }

  return "家园仍处于初始整理阶段，管家正在确认最基础的空间秩序。"
}

export function buildHomeSpaceSummary(
  home: HomeState
): HomeSpaceSummary {
  const spaces = syncHomeSpaces(home)

  const activeSpaceIds = getSpaceIds(
    spaces,
    (space) => space.status === "active"
  )
  const availableSpaceIds = getSpaceIds(
    spaces,
    (space) => space.status === "available"
  )
  const buildingSpaceIds = getSpaceIds(
    spaces,
    (space) => space.status === "building"
  )
  const maintenanceSpaceIds = getSpaceIds(
    spaces,
    (space) =>
      space.status !== "locked" &&
      (space.stability < 35 || space.comfort < 30)
  )
  const activitySpaceIds = getSpaceIds(
    spaces,
    (space) =>
      space.status !== "locked" &&
      (space.activity >= 18 || space.role === "garden" || space.role === "activity")
  )

  const primarySpace = resolvePrimarySpace(spaces)

  return {
    primarySpaceId: primarySpace.id,
    primarySpaceName: primarySpace.name,
    buildingSpaceIds,
    activeSpaceIds,
    availableSpaceIds,
    maintenanceSpaceIds,
    activitySpaceIds,
    overallComfort: average(spaces.map((space) => space.comfort)),
    overallStability: average(spaces.map((space) => space.stability)),
    overallActivity: average(spaces.map((space) => space.activity)),
    summary: buildSummaryText({
      home,
      primarySpace,
      buildingSpaceIds,
      activeSpaceIds,
    }),
    tags: Array.from(new Set([
      "home_space_summary",
      `primary_${primarySpace.id}`,
      `stage_${home.constructionStage}`,
      `focus_${home.evolutionFocus}`,
      activeSpaceIds.length > 0 ? "has_active_space" : "no_active_space",
      buildingSpaceIds.length > 0 ? "has_building_space" : "no_building_space",
    ])),
  }
}
