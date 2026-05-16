/**
 * 当前文件负责：提供 MVP 建设闭环入口。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import { applyMapDiffs } from "@/world/map-state/map-diff-engine"

import type { ConstructionPlan } from "./construction-schema"
import { advanceConstructionPlan } from "./construction-executor"
import { createInitialConstructionPlan } from "./construction-planner"

export const MVP_CONSTRUCTION_AUTO_ADVANCE_TICK_INTERVAL = 3

export type AdvanceMvpConstructionByWorldTickInput = {
  homeMapState: HomeMapState
  plan: ConstructionPlan | null
  worldTick: number
  now: number
}

export type AdvanceMvpConstructionByWorldTickResult = {
  homeMapState: HomeMapState
  plan: ConstructionPlan | null
  messages: string[]
  didAdvance: boolean
}

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

export function advanceMvpConstructionByWorldTick(
  input: AdvanceMvpConstructionByWorldTickInput
): AdvanceMvpConstructionByWorldTickResult {
  const hasPetRestZone = input.homeMapState.zones.some(
    (zone) => zone.type === "pet_rest"
  )

  if (!hasPetRestZone) {
    return {
      homeMapState: input.homeMapState,
      plan: input.plan,
      messages: ["未找到宠物休息区，自动建设暂时无法推进。"],
      didAdvance: false,
    }
  }

  const plan =
    input.plan ?? createMvpPetRestConstructionPlan(input.homeMapState)

  if (plan.currentStage === "completed") {
    return {
      homeMapState: input.homeMapState,
      plan,
      messages: ["宠物休息角建设已经完成。"],
      didAdvance: false,
    }
  }

  if (input.worldTick % MVP_CONSTRUCTION_AUTO_ADVANCE_TICK_INTERVAL !== 0) {
    return {
      homeMapState: input.homeMapState,
      plan,
      messages: [],
      didAdvance: false,
    }
  }

  const result = advanceMvpConstruction(input.homeMapState, plan, input.now)

  return {
    ...result,
    didAdvance: true,
  }
}
