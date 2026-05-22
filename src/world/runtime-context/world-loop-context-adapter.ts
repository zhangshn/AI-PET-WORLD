/**
 * 当前文件职责：将运行时 context 转换为 world-loop 可使用的 intent context。
 */

import type {
  ButlerIntentContext,
  PetIntentContext,
} from "@/world/intent-system/intent-gateway"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"

import type {
  ButlerRuntimeContext,
  ButlerRuntimeNeedSignal,
} from "./butler-runtime-context-schema"
import type {
  PetRuntimeContext,
  PetRuntimeNeedSignal,
} from "./pet-runtime-context-schema"

export type BuildButlerIntentContextFromRuntimeInput = {
  butlerRuntimeContext: ButlerRuntimeContext
}

export type BuildPetIntentContextFromRuntimeInput = {
  petRuntimeContext: PetRuntimeContext
}

export type RuntimeToIntentContextAdapterResult = {
  butler: ButlerIntentContext
  pet: PetIntentContext
  tags: string[]
}

export type BuildRuntimeToIntentContextInput = {
  butlerRuntimeContext: ButlerRuntimeContext
  petRuntimeContext: PetRuntimeContext
}

export function buildButlerIntentContextFromRuntime(
  input: BuildButlerIntentContextFromRuntimeInput
): ButlerIntentContext {
  const { butlerRuntimeContext } = input
  const topNeedSignal = findTopButlerRuntimeNeedSignal(
    butlerRuntimeContext.needSignals
  )

  return {
    mood: butlerRuntimeContext.mood,
    currentTask: resolveButlerIntentTask({
      runtimeTask: butlerRuntimeContext.currentTask,
      topNeedSignal,
    }),
    constructionStyle: normalizeButlerConstructionStyleForIntent(
      butlerRuntimeContext.constructionStyle
    ),
    tags: [
      "butler_intent_context_from_runtime",
      `runtime_mood:${butlerRuntimeContext.mood}`,
      `runtime_task:${butlerRuntimeContext.currentTask}`,
      `concern:${butlerRuntimeContext.concernLevel}`,
      topNeedSignal ? `top_need:${topNeedSignal.type}` : "top_need:none",
      ...butlerRuntimeContext.tags,
    ],
  }
}

export function buildPetIntentContextFromRuntime(
  input: BuildPetIntentContextFromRuntimeInput
): PetIntentContext {
  const { petRuntimeContext } = input
  const topNeedSignal = findTopPetRuntimeNeedSignal(
    petRuntimeContext.needSignals
  )

  return {
    energy: clampRuntimeValue(petRuntimeContext.energy),
    hunger: clampRuntimeValue(petRuntimeContext.hunger),
    mood: petRuntimeContext.mood,
    currentZoneType: petRuntimeContext.location.zoneType,
    recentAction: petRuntimeContext.currentAction,
    tags: [
      "pet_intent_context_from_runtime",
      `life_stage:${petRuntimeContext.lifeStage}`,
      `runtime_mood:${petRuntimeContext.mood}`,
      `drive:${petRuntimeContext.currentDrive}`,
      `action:${petRuntimeContext.currentAction}`,
      topNeedSignal ? `top_need:${topNeedSignal.type}` : "top_need:none",
      ...petRuntimeContext.tags,
    ],
  }
}

export function buildRuntimeToIntentContext(
  input: BuildRuntimeToIntentContextInput
): RuntimeToIntentContextAdapterResult {
  const butler = buildButlerIntentContextFromRuntime({
    butlerRuntimeContext: input.butlerRuntimeContext,
  })
  const pet = buildPetIntentContextFromRuntime({
    petRuntimeContext: input.petRuntimeContext,
  })

  return {
    butler,
    pet,
    tags: [
      "runtime_to_intent_context_adapter_v0",
      `world:${input.butlerRuntimeContext.worldId}`,
      `owner:${input.butlerRuntimeContext.ownerId}`,
      `butler_tick:${input.butlerRuntimeContext.tickIndex}`,
      `pet_tick:${input.petRuntimeContext.tickIndex}`,
    ],
  }
}

export function resolveButlerIntentTask(input: {
  runtimeTask: ButlerRuntimeContext["currentTask"]
  topNeedSignal?: ButlerRuntimeNeedSignal
}): string {
  if (input.topNeedSignal?.type === "pet_care") {
    return "care_pet"
  }

  if (input.topNeedSignal?.type === "space_organization") {
    return "organize_space"
  }

  if (input.topNeedSignal?.type === "resource_review") {
    return "inspect_environment"
  }

  if (input.topNeedSignal?.type === "environment_review") {
    return "inspect_environment"
  }

  if (input.topNeedSignal?.type === "rest") {
    return "rest"
  }

  return input.runtimeTask
}

export function findTopButlerRuntimeNeedSignal(
  needSignals: ButlerRuntimeNeedSignal[]
): ButlerRuntimeNeedSignal | undefined {
  return [...needSignals].sort((leftNeedSignal, rightNeedSignal) => {
    if (rightNeedSignal.score !== leftNeedSignal.score) {
      return rightNeedSignal.score - leftNeedSignal.score
    }

    return (
      getRuntimeNeedUrgencyWeight(rightNeedSignal.urgency) -
      getRuntimeNeedUrgencyWeight(leftNeedSignal.urgency)
    )
  })[0]
}

export function findTopPetRuntimeNeedSignal(
  needSignals: PetRuntimeNeedSignal[]
): PetRuntimeNeedSignal | undefined {
  return [...needSignals].sort((leftNeedSignal, rightNeedSignal) => {
    if (rightNeedSignal.score !== leftNeedSignal.score) {
      return rightNeedSignal.score - leftNeedSignal.score
    }

    return (
      getRuntimeNeedUrgencyWeight(rightNeedSignal.urgency) -
      getRuntimeNeedUrgencyWeight(leftNeedSignal.urgency)
    )
  })[0]
}

export function getRuntimeNeedUrgencyWeight(
  urgency: "none" | "low" | "medium" | "high" | "critical"
): number {
  if (urgency === "critical") return 5
  if (urgency === "high") return 4
  if (urgency === "medium") return 3
  if (urgency === "low") return 2

  return 1
}

export function clampRuntimeValue(value: number): number {
  if (value < 0) return 0
  if (value > 100) return 100

  return value
}

export function normalizeButlerConstructionStyleForIntent(
  constructionStyle: ButlerConstructionStyleVector
): ButlerConstructionStyleVector {
  return {
    structuredBuilder: normalizeStyleValueForIntent(
      constructionStyle.structuredBuilder
    ),
    warmCaretaker: normalizeStyleValueForIntent(
      constructionStyle.warmCaretaker
    ),
    protectiveKeeper: normalizeStyleValueForIntent(
      constructionStyle.protectiveKeeper
    ),
    aestheticOrganizer: normalizeStyleValueForIntent(
      constructionStyle.aestheticOrganizer
    ),
    quietMaintainer: normalizeStyleValueForIntent(
      constructionStyle.quietMaintainer
    ),
    adaptivePlanner: normalizeStyleValueForIntent(
      constructionStyle.adaptivePlanner
    ),
  }
}

export function normalizeStyleValueForIntent(value: number): number {
  if (!Number.isFinite(value)) return 50

  if (value >= 0 && value <= 1) {
    return Math.round(value * 100)
  }

  if (value < 0) return 0
  if (value > 100) return 100

  return Math.round(value)
}
