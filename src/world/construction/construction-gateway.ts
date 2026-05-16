/**
 * 当前文件负责：提供 MVP 建设闭环入口。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import { applyMapDiffs } from "@/world/map-state/map-diff-engine"

import type { ConstructionPlan } from "./construction-schema"
import { advanceConstructionPlan } from "./construction-executor"
import { createInitialConstructionPlan } from "./construction-planner"

export function createMvpPetRestConstructionPlan(
  homeMapState: HomeMapState
): ConstructionPlan {
  return createInitialConstructionPlan(homeMapState)
}

export function advanceMvpConstruction(
  homeMapState: HomeMapState,
  plan: ConstructionPlan,
  now: number
): {
  homeMapState: HomeMapState
  plan: ConstructionPlan
  messages: string[]
} {
  const result = advanceConstructionPlan({
    homeMapState,
    plan,
    now,
  })

  return {
    homeMapState: applyMapDiffs(homeMapState, result.mapDiffs),
    plan: result.nextPlan,
    messages: result.messages,
  }
}
