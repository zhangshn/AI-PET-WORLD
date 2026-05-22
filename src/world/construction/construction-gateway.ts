/**
 * 当前文件职责：提供 MVP 建设闭环入口。
 */

import type { HomeMapState, MapDiff } from "@/world/map-state/home-map-state-schema"
import { applyMapDiffs } from "@/world/map-state/map-diff-engine"
import {
  type RejectedMapDiff,
  validateMapDiffs,
} from "@/world/map-state/map-diff-validator"

import {
  buildMapDiffsFromConstructionIntents,
} from "./construction-diff-planner"
import {
  buildConstructionIntents,
} from "./construction-intent-planner"
import type {
  ButlerConstructionContext,
  ConstructionIntent,
  PetConstructionContext,
} from "./construction-intent-schema"
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

export type RunConstructionIntentDiffCycleInput = {
  homeMapState: HomeMapState
  pet: PetConstructionContext
  butler: ButlerConstructionContext
  worldTick: number
  now: number
}

export type RunConstructionIntentDiffCycleResult = {
  nextHomeMapState: HomeMapState
  intents: ConstructionIntent[]
  proposedDiffs: MapDiff[]
  acceptedDiffs: MapDiff[]
  rejectedDiffs: RejectedMapDiff[]
  messages: string[]
  didAdvance: boolean
  tags: string[]
}

export function createMvpQuietLivingConstructionPlan(
  homeMapState: HomeMapState
): ConstructionPlan {
  return createInitialConstructionPlan(homeMapState)
}

export function runConstructionIntentDiffCycle(
  input: RunConstructionIntentDiffCycleInput
): RunConstructionIntentDiffCycleResult {
  const intentResult = buildConstructionIntents({
    worldTick: input.worldTick,
    now: input.now,
    pet: input.pet,
    butler: input.butler,
    resources: input.homeMapState.resources,
  })
  const diffResult = buildMapDiffsFromConstructionIntents({
    homeMapState: input.homeMapState,
    intents: intentResult.intents,
    now: input.now,
  })
  const validationResult = validateMapDiffs({
    homeMapState: input.homeMapState,
    mapDiffs: diffResult.mapDiffs,
  })
  const nextHomeMapState = applyMapDiffs(
    input.homeMapState,
    validationResult.acceptedDiffs
  )

  return {
    nextHomeMapState,
    intents: intentResult.intents,
    proposedDiffs: diffResult.mapDiffs,
    acceptedDiffs: validationResult.acceptedDiffs,
    rejectedDiffs: validationResult.rejectedDiffs,
    messages: [
      ...intentResult.messages,
      ...diffResult.messages,
      ...validationResult.warnings.map((warning) => `拒绝地图变化：${warning}`),
    ],
    didAdvance: validationResult.acceptedDiffs.length > 0,
    tags: ["construction_intent_diff_cycle_result"],
  }
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
  const hasQuietLivingZone = input.homeMapState.zones.some(
    (zone) => zone.type === "quiet_living"
  )

  if (!hasQuietLivingZone) {
    return {
      homeMapState: input.homeMapState,
      plan: input.plan,
      messages: ["未找到安静生活区，自动建设暂时无法推进。"],
      didAdvance: false,
    }
  }

  const plan =
    input.plan ?? createMvpQuietLivingConstructionPlan(input.homeMapState)

  if (plan.currentStage === "completed") {
    return {
      homeMapState: input.homeMapState,
      plan,
      messages: ["安静生活区建设已经完成。"],
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
