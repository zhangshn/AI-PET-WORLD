/**
 * 当前文件负责：提供建设意图到地图变化的调试场景。
 */

import { generateInitialHomeMap } from "@/world/generation/initial-home-generator"
import type { ButlerConstructionStyleVector } from "@/world/generation/generation-schema"
import type {
  HomeMapState,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  createAddPlacementDiff,
  createMovePlacementDiff,
  createRemovePlacementDiff,
} from "@/world/map-state/map-diff-engine"
import {
  type MapDiffValidationResult,
  validateMapDiffs,
} from "@/world/map-state/map-diff-validator"
import type { WorldMapAssetId } from "@/world/map-assets/world-map-asset-registry"
import {
  buildWorldCreationRuntime,
  type CreateWorldInput,
  type WorldCreationRuntimeResult,
} from "@/world/creation/world-creation-runtime"

import {
  runConstructionIntentDiffCycle,
  type RunConstructionIntentDiffCycleResult,
} from "./construction-gateway"

export type ConstructionDebugPetPreset = "tired_hungry" | "stable" | "resting"

export type ConstructionDebugButlerPreset =
  | "balanced"
  | "protective"
  | "aesthetic"

export type ConstructionDebugCreateWorldInput = CreateWorldInput

export type ConstructionDebugRuntime = WorldCreationRuntimeResult

export type ValidatorSafetyTestResult = {
  proposedDiffs: MapDiff[]
  acceptedDiffs: MapDiff[]
  rejectedDiffs: MapDiffValidationResult["rejectedDiffs"]
  summary: {
    proposedCount: number
    acceptedCount: number
    rejectedCount: number
    passed: boolean
    warnings: string[]
  }
}

export type ConstructionDebugScenarioInput = {
  createWorldInput: ConstructionDebugCreateWorldInput
  petPreset: ConstructionDebugPetPreset
  butlerPreset: ConstructionDebugButlerPreset
}

export type ConstructionDebugScenarioResult = {
  createWorldInput: ConstructionDebugCreateWorldInput
  runtime: ConstructionDebugRuntime
  initialHomeMapState: HomeMapState
  constructionCycle: RunConstructionIntentDiffCycleResult
  validatorSafetyTest: ValidatorSafetyTestResult
}

export const DEFAULT_CONSTRUCTION_DEBUG_CREATE_WORLD_INPUT: ConstructionDebugCreateWorldInput =
  {
    year: 1998,
    month: 1,
    day: 1,
    time: "08:00",
    perspective: "unspecified",
    createdAt: 1_700_000_000_000,
  }

export const CONSTRUCTION_DEBUG_WORLD_TICK = 12

export function buildConstructionDebugScenario(
  input: ConstructionDebugScenarioInput
): ConstructionDebugScenarioResult {
  const runtime = buildWorldCreationRuntime({
    createWorldInput: input.createWorldInput,
  })

  const adjustedConstructionStyle = buildDebugConstructionStyle({
    baseStyle: runtime.butlerConstructionStyle,
    butlerPreset: input.butlerPreset,
  })

  const finalRuntime: ConstructionDebugRuntime = {
    ...runtime,
    butlerConstructionStyle: adjustedConstructionStyle,
  }

  const initialHomeMapState = generateInitialHomeMap({
    worldId: finalRuntime.worldId,
    ownerId: finalRuntime.ownerId,
    birthSignature: finalRuntime.birthSignature,
    worldSalt: finalRuntime.worldSalt,
    butlerConstructionStyle: finalRuntime.butlerConstructionStyle,
    now: finalRuntime.now,
  })

  const constructionCycle = runConstructionIntentDiffCycle({
    homeMapState: initialHomeMapState,
    pet: buildDebugPetContext(input.petPreset),
    butler: {
      mood: "focused",
      currentTask: "observe_home",
      constructionStyle: finalRuntime.butlerConstructionStyle,
      tags: ["mapdiff_debug_butler"],
    },
    worldTick: CONSTRUCTION_DEBUG_WORLD_TICK,
    now: finalRuntime.now + CONSTRUCTION_DEBUG_WORLD_TICK,
  })

  const validatorSafetyTest = buildValidatorSafetyTest({
    homeMapState: initialHomeMapState,
    now: finalRuntime.now + CONSTRUCTION_DEBUG_WORLD_TICK + 1,
  })

  return {
    createWorldInput: input.createWorldInput,
    runtime: finalRuntime,
    initialHomeMapState,
    constructionCycle,
    validatorSafetyTest,
  }
}

function buildDebugPetContext(preset: ConstructionDebugPetPreset) {
  if (preset === "stable") {
    return {
      energy: 68,
      hunger: 32,
      mood: "stable",
      currentZoneType: "initial_care" as const,
      recentAction: "observing",
      tags: ["mapdiff_debug_pet", "stable_pet"],
    }
  }

  if (preset === "resting") {
    return {
      energy: 22,
      hunger: 38,
      mood: "quiet",
      currentZoneType: "pet_rest" as const,
      recentAction: "resting",
      tags: ["mapdiff_debug_pet", "resting_pet"],
    }
  }

  return {
    energy: 28,
    hunger: 72,
    mood: "curious",
    currentZoneType: "pet_arrival" as const,
    recentAction: "arrived",
    tags: ["mapdiff_debug_pet", "tired_hungry_pet"],
  }
}

function buildDebugConstructionStyle(input: {
  baseStyle: ButlerConstructionStyleVector
  butlerPreset: ConstructionDebugButlerPreset
}): ButlerConstructionStyleVector {
  if (input.butlerPreset === "protective") {
    return {
      ...input.baseStyle,
      protectiveKeeper: 0.86,
      aestheticOrganizer: Math.max(input.baseStyle.aestheticOrganizer, 0.42),
    }
  }

  if (input.butlerPreset === "aesthetic") {
    return {
      ...input.baseStyle,
      aestheticOrganizer: 0.86,
      warmCaretaker: Math.max(input.baseStyle.warmCaretaker, 0.68),
    }
  }

  return input.baseStyle
}

function buildValidatorSafetyTest(input: {
  homeMapState: HomeMapState
  now: number
}): ValidatorSafetyTestResult {
  const protectedPlacement = findProtectedPlacement(input.homeMapState)
  const pathPlacement = input.homeMapState.placements.find(
    (placement) => placement.layer === "path"
  )
  const firstPlacement = input.homeMapState.placements[0]

  const proposedDiffs = [
    createAddPlacementDiff({
      id: "safety-test-invalid-asset",
      placementId: "safety-test-invalid-asset",
      placement: createDebugPlacement({
        id: "safety-test-invalid-asset",
        assetId: "notRegisteredAsset01" as WorldMapAssetId,
        x: 2,
        y: 2,
        layer: "surface-decoration",
        tags: ["safety_test", "invalid_asset"],
      }),
      reason: "安全测试：未注册 assetId 应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "invalid_asset"],
    }),
    createAddPlacementDiff({
      id: "safety-test-out-of-bounds",
      placementId: "safety-test-out-of-bounds",
      placement: createDebugPlacement({
        id: "safety-test-out-of-bounds",
        assetId: "surfaceFlowerPatch01",
        x: input.homeMapState.mapSize.columns + 99,
        y: input.homeMapState.mapSize.rows + 99,
        layer: "surface-decoration",
        tags: ["safety_test", "out_of_bounds"],
      }),
      reason: "安全测试：越界坐标应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "out_of_bounds"],
    }),
    createAddPlacementDiff({
      id: "safety-test-duplicate-placement",
      placementId: firstPlacement?.id ?? "missing-placement",
      placement: createDebugPlacement({
        id: firstPlacement?.id ?? "missing-placement",
        assetId: "surfaceFlowerPatch01",
        x: 3,
        y: 3,
        layer: "surface-decoration",
        tags: ["safety_test", "duplicate_placement"],
      }),
      reason: "安全测试：重复 placementId 应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "duplicate_placement"],
    }),
    createAddPlacementDiff({
      id: "safety-test-layer-mismatch",
      placementId: "safety-test-layer-mismatch",
      placement: createDebugPlacement({
        id: "safety-test-layer-mismatch",
        assetId: "facilityFoodBowlFull01",
        x: 4,
        y: 4,
        layer: "nature",
        tags: ["safety_test", "layer_mismatch"],
      }),
      reason: "安全测试：asset category 与 layer 不匹配应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "layer_mismatch"],
    }),
    createAddPlacementDiff({
      id: "safety-test-cover-path",
      placementId: "safety-test-cover-path",
      placement: createDebugPlacement({
        id: "safety-test-cover-path",
        assetId: "surfaceFlowerPatch01",
        x: pathPlacement?.x ?? 1,
        y: pathPlacement?.y ?? 1,
        layer: "surface-decoration",
        tags: ["safety_test", "cover_path"],
      }),
      reason: "安全测试：覆盖路径应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "cover_path"],
    }),
    createMovePlacementDiff({
      id: "safety-test-move-protected",
      placementId: protectedPlacement?.id ?? "missing-protected-placement",
      patch: {
        x: 1,
        y: 1,
      },
      reason: "安全测试：移动受保护核心对象应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "move_protected"],
    }),
    createRemovePlacementDiff({
      id: "safety-test-remove-protected",
      placementId: protectedPlacement?.id ?? "missing-protected-placement",
      reason: "安全测试：删除受保护核心对象应被拒绝。",
      createdAt: input.now,
      tags: ["safety_test", "remove_protected"],
    }),
  ]

  const validationResult = validateMapDiffs({
    homeMapState: input.homeMapState,
    mapDiffs: proposedDiffs,
  })

  return {
    proposedDiffs,
    acceptedDiffs: validationResult.acceptedDiffs,
    rejectedDiffs: validationResult.rejectedDiffs,
    summary: {
      proposedCount: proposedDiffs.length,
      acceptedCount: validationResult.acceptedDiffs.length,
      rejectedCount: validationResult.rejectedDiffs.length,
      passed:
        validationResult.acceptedDiffs.length === 0 &&
        validationResult.rejectedDiffs.length === proposedDiffs.length,
      warnings: validationResult.warnings,
    },
  }
}

function createDebugPlacement(input: {
  id: string
  assetId: WorldMapAssetId
  x: number
  y: number
  layer: MapPlacement["layer"]
  tags: string[]
}): MapPlacement {
  return {
    id: input.id,
    assetId: input.assetId,
    x: input.x,
    y: input.y,
    layer: input.layer,
    scale: 1,
    alpha: 1,
    label: input.id,
    source: "construction_plan",
    tags: input.tags,
  }
}

function findProtectedPlacement(homeMapState: HomeMapState) {
  return homeMapState.placements.find((placement) =>
    placement.tags.some((tag) =>
      [
        "core_living",
        "arrival_focus",
        "temporary_shelter",
        "pet_bed",
        "butler",
        "pet",
        "actor",
      ].includes(tag)
    )
  )
}