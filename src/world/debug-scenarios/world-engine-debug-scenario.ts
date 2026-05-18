/**
 * 当前文件职责：从建设调试场景派生完整世界引擎调试结果。
 */

import type {
  ConstructionDebugPetPreset,
  ConstructionDebugScenarioResult,
} from "@/world/construction/construction-debug-scenario"
import {
  buildEnvironmentStateFromHomeMap,
} from "@/world/environment/environment-gateway"
import { buildPlacementGeometryAuditReport } from "@/world/geometry-audit/geometry-audit-gateway"
import {
  buildButlerIntentDecision,
  type ButlerIntentContext,
  type PetIntentContext,
  type WorldIntentContext,
} from "@/world/intent-system/intent-gateway"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import { validateMapDiffs } from "@/world/map-state/map-diff-validator"
import {
  buildWorldChangePlan,
  buildWorldDiffProposal,
} from "@/world/world-evolution/world-evolution-gateway"
import { buildWorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import { buildWorldEvolutionExecution } from "@/world/world-evolution-executor/world-evolution-executor-gateway"

import type {
  BuildWorldEngineDebugScenarioInput,
  WorldEngineDebugScenarioResult,
  WorldEngineDebugStageResult,
} from "./world-engine-debug-scenario-schema"

export function buildWorldEngineDebugScenario(
  input: BuildWorldEngineDebugScenarioInput
): WorldEngineDebugScenarioResult {
  return {
    initial: buildWorldEngineDebugStage({
      debugResult: input.debugResult,
      homeMapState: input.debugResult.initialHomeMapState,
      petPreset: input.petPreset,
      worldTick: 0,
    }),
    next: buildWorldEngineDebugStage({
      debugResult: input.debugResult,
      homeMapState: input.debugResult.constructionCycle.nextHomeMapState,
      petPreset: input.petPreset,
      worldTick: 12,
    }),
    tags: ["world_engine_debug_scenario_v0"],
  }
}

function buildWorldEngineDebugStage(input: {
  debugResult: ConstructionDebugScenarioResult
  homeMapState: HomeMapState
  petPreset: ConstructionDebugPetPreset
  worldTick: number
}): WorldEngineDebugStageResult {
  const environmentState = buildEnvironmentStateFromHomeMap({
    homeMapState: input.homeMapState,
    generatedAt: input.homeMapState.updatedAt,
  })
  const placementGeometryAudit = buildPlacementGeometryAuditReport({
    homeMapState: input.homeMapState,
    checkedAt: input.homeMapState.updatedAt,
  })
  const butlerIntentDecision = buildButlerIntentDecision({
    butler: buildDebugButlerIntentContext({
      debugResult: input.debugResult,
    }),
    pet: buildDebugPetIntentContext({ petPreset: input.petPreset }),
    environment: environmentState,
    world: buildWorldIntentContext({
      homeMapState: input.homeMapState,
      worldTick: input.worldTick,
    }),
  })
  const worldChangePlan = buildWorldChangePlan({
    homeMapState: input.homeMapState,
    environment: environmentState,
    decision: butlerIntentDecision,
    now: input.homeMapState.updatedAt,
  })
  const worldDiffProposal = buildWorldDiffProposal({
    homeMapState: input.homeMapState,
    plan: worldChangePlan,
    now: input.homeMapState.updatedAt,
  })
  const worldDiffProposalValidation = validateMapDiffs({
    homeMapState: input.homeMapState,
    mapDiffs: worldDiffProposal.mapDiffs,
  })
  const worldEvolutionAudit = buildWorldEvolutionAuditReport({
    checkedAt: input.homeMapState.updatedAt,
    decision: butlerIntentDecision,
    plan: worldChangePlan,
    proposal: worldDiffProposal,
    validation: worldDiffProposalValidation,
  })
  const worldEvolutionExecution = buildWorldEvolutionExecution({
    homeMapState: input.homeMapState,
    proposal: worldDiffProposal,
    audit: worldEvolutionAudit,
    now: input.homeMapState.updatedAt,
  })

  return {
    environmentState,
    placementGeometryAudit,
    butlerIntentDecision,
    worldChangePlan,
    worldDiffProposal,
    worldDiffProposalValidation,
    worldEvolutionAudit,
    worldEvolutionExecution,
  }
}

function buildDebugPetIntentContext(input: {
  petPreset: ConstructionDebugPetPreset
}): PetIntentContext {
  if (input.petPreset === "tired_hungry") {
    return {
      energy: 28,
      hunger: 72,
      mood: "curious",
      currentZoneType: "pet_arrival",
      recentAction: "arrived",
      tags: ["mapdiff_debug_pet", "tired_hungry_pet"],
    }
  }

  if (input.petPreset === "stable") {
    return {
      energy: 68,
      hunger: 32,
      mood: "stable",
      currentZoneType: "initial_care",
      recentAction: "observing",
      tags: ["mapdiff_debug_pet", "stable_pet"],
    }
  }

  return {
    energy: 22,
    hunger: 38,
    mood: "quiet",
    currentZoneType: "pet_rest",
    recentAction: "resting",
    tags: ["mapdiff_debug_pet", "resting_pet"],
  }
}

function buildDebugButlerIntentContext(input: {
  debugResult: ConstructionDebugScenarioResult
}): ButlerIntentContext {
  return {
    mood: "focused",
    currentTask: "observe_home",
    constructionStyle: input.debugResult.runtime.butlerConstructionStyle,
    tags: ["mapdiff_debug_butler"],
  }
}

function buildWorldIntentContext(input: {
  homeMapState: HomeMapState
  worldTick: number
}): WorldIntentContext {
  return {
    worldTick: input.worldTick,
    spacePressure: input.homeMapState.resources.spacePressure,
    constructionPlanCount: input.homeMapState.constructionPlans.length,
    activeConstructionPlanCount: input.homeMapState.constructionPlans.filter(
      (plan) => plan.status === "active"
    ).length,
    tags: ["mapdiff_debug_world_context"],
  }
}
