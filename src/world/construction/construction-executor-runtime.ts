/**
 * 当前文件职责：执行管家建设计划，并生成 update/add MapDiff 候选。
 */

import type {
  HomeZone,
  MapDiff,
  MapPlacement,
} from "@/world/map-state/home-map-state-schema"
import {
  buildInitialResourcePoolState,
  runResourceCycle,
} from "@/world/resource-cycle/resource-cycle"
import type { ResourcePoolState } from "@/world/resource-cycle/resource-schema"

import { auditConstructionExecutionResult } from "./construction-execution-audit"
import type {
  ConstructionExecutionInput,
  ConstructionExecutionResult,
  ConstructionPlan,
  ConstructionProjectType,
  ConstructionStage,
  ConstructionStageType,
} from "./construction-schema"
import {
  buildDeferredConstructionPlacement,
  shouldCreateDeferredConstructionPlacement,
} from "./deferred-construction-placement"

const STAGE_ORDER: readonly ConstructionStageType[] = [
  "planned",
  "preparing_ground",
  "placing_materials",
  "building",
  "decorating",
  "completed",
]

const STAGE_PROGRESS_INCREMENT = 35

export function buildConstructionExecutionResult(
  input: ConstructionExecutionInput
): ConstructionExecutionResult {
  const executableStage = resolveExecutableStage(input.plan.currentStage)
  const resourceCycleResult = runResourceCycle({
    resourcePool: buildExecutionResourcePool(input),
    cycleId: `construction:${input.plan.id}:${executableStage}`,
    reason: input.plan.reason,
    includeNaturalRegeneration: false,
    requests: buildRuntimeResourceRequests({
      input,
      executableStage,
    }),
    tags: [
      "construction_resource_cycle",
      `plan:${input.plan.id}`,
      `stage:${executableStage}`,
    ],
  })
  const blockedByResources = resourceCycleResult.transactions.some(
    (transaction) => transaction.status === "blocked"
  )
  const targetPlacements = findExecutablePlacements({
    input,
    executableStage,
  })
  const mapDiffs = blockedByResources
    ? []
    : buildConstructionMapDiffs({
        input,
        executableStage,
        targetPlacements,
      })
  const nextPlan = buildNextPlan({
    plan: input.plan,
    now: input.now,
    executableStage,
    mapDiffIds: mapDiffs.map((diff) => diff.id),
    blockedByResources,
  })
  const resultWithoutAudit: Omit<ConstructionExecutionResult, "audit"> = {
    nextPlan,
    resourceCycleResult,
    resourceTransactions: resourceCycleResult.transactions,
    mapDiffs,
    messages: buildExecutionMessages({
      input,
      mapDiffs,
    }),
    tags: [
      "construction_execution_result",
      "construction_execution_candidate",
      "map_diff_candidate_only",
      "resource_transaction_checked",
      "no_direct_home_map_state_mutation",
      `plan:${input.plan.id}`,
      `target:${input.plan.targetZoneType}`,
      `stage:${executableStage}`,
    ],
  }
  const audit = auditConstructionExecutionResult({
    executionInput: input,
    resultWithoutAudit,
  })

  return {
    ...resultWithoutAudit,
    audit,
  }
}

function buildRuntimeResourceRequests(input: {
  input: ConstructionExecutionInput
  executableStage: ConstructionStageType
}): ConstructionPlan["resourceRequests"] {
  const tickToken = `tick-${input.input.worldDay ?? "unknown"}`

  return input.input.plan.resourceRequests.map((request, index) => {
    const baseTransactionId =
      request.transactionId ??
      `${input.input.plan.id}:${request.resourceKey}:${index.toString(36)}`

    return {
      ...request,
      transactionId: [
        normalizeIdToken(baseTransactionId),
        input.executableStage,
        tickToken,
      ].join(":"),
      tags: uniqueTags([
        ...(request.tags ?? []),
        `stage:${input.executableStage}`,
        tickToken,
      ]),
    }
  })
}

export function advanceConstructionPlan(
  input: ConstructionExecutionInput
): ConstructionExecutionResult {
  return buildConstructionExecutionResult(input)
}

function buildExecutionResourcePool(
  input: ConstructionExecutionInput
): ResourcePoolState {
  return (
    input.homeMapState.resources.resourcePoolState ??
    buildInitialResourcePoolState({
      worldId: input.homeMapState.worldId,
      regionId: "construction-execution-fallback",
      seed: input.homeMapState.seed,
      currentOverrides: {
        groundHealth: input.homeMapState.resources.groundHealth,
        naturalGrowth: input.homeMapState.resources.naturalGrowth,
        materialReadiness: input.homeMapState.resources.materialReadiness,
        careReadiness: input.homeMapState.resources.careReadiness,
        spacePressure: input.homeMapState.resources.spacePressure,
      },
      tags: ["construction_execution_resource_pool_fallback"],
    })
  )
}

function resolveExecutableStage(
  currentStage: ConstructionStageType
): ConstructionStageType {
  if (currentStage === "planned") return "preparing_ground"
  return currentStage
}

function buildConstructionMapDiffs(input: {
  input: ConstructionExecutionInput
  executableStage: ConstructionStageType
  targetPlacements: MapPlacement[]
}): MapDiff[] {
  if (input.targetPlacements.length > 0) {
    return input.targetPlacements.map((placement, index) =>
      buildConstructionUpdateMapDiff({
        input: input.input,
        placement,
        executableStage: input.executableStage,
        index,
      })
    )
  }

  const deferredPlacement = buildDeferredConstructionPlacement({
    homeMapState: input.input.homeMapState,
    plan: input.input.plan,
    executableStage: input.executableStage,
  })

  if (!deferredPlacement) return []

  return [
    buildConstructionAddMapDiff({
      input: input.input,
      placement: deferredPlacement,
      executableStage: input.executableStage,
    }),
  ]
}

function findExecutablePlacements(input: {
  input: ConstructionExecutionInput
  executableStage: ConstructionStageType
}): MapPlacement[] {
  if (input.executableStage === "completed") return []
  if (input.input.plan.projectType === "prepare_future_expansion") return []

  const targetZone = findTargetZone(input.input)
  const scopedPlacements = input.input.homeMapState.placements.filter((placement) =>
    targetZone ? isPlacementInsideZone(placement, targetZone) : true
  )
  const projectPlacements = scopedPlacements.filter((placement) =>
    matchesProjectPlacement(input.input.plan.projectType, placement)
  )

  if (projectPlacements.length > 0) {
    return projectPlacements.slice(0, 3)
  }

  if (shouldCreateDeferredConstructionPlacement(input.input.plan.projectType)) {
    return []
  }

  return scopedPlacements
    .filter((placement) => placement.layer !== "actor")
    .slice(0, 2)
}

function findTargetZone(input: ConstructionExecutionInput): HomeZone | undefined {
  return input.homeMapState.zones.find(
    (zone) => zone.type === input.plan.targetZoneType
  )
}

function isPlacementInsideZone(placement: MapPlacement, zone: HomeZone): boolean {
  const maxX = zone.bounds.x + zone.bounds.width
  const maxY = zone.bounds.y + zone.bounds.height

  return (
    placement.x >= zone.bounds.x &&
    placement.x <= maxX &&
    placement.y >= zone.bounds.y &&
    placement.y <= maxY
  )
}

function matchesProjectPlacement(
  projectType: ConstructionProjectType,
  placement: MapPlacement
): boolean {
  if (projectType === "stabilize_temporary_shelter") {
    return placement.layer === "structure" || hasTagToken(placement, "temporary_shelter")
  }

  if (projectType === "improve_initial_care") {
    return placement.layer === "facility" || hasTagToken(placement, "initial_care")
  }

  if (projectType === "organize_storage_area") {
    return placement.layer === "facility" || hasTagToken(placement, "storage_tools")
  }

  if (projectType === "maintain_natural_boundary") {
    return placement.layer === "nature" || hasTagToken(placement, "natural_boundary")
  }

  if (projectType === "preserve_quiet_living") {
    return hasTagToken(placement, "quiet_living") || placement.layer === "surface-decoration"
  }

  if (projectType === "decorate_home") {
    return placement.layer === "surface-decoration"
  }

  return false
}

function hasTagToken(placement: MapPlacement, token: string): boolean {
  return placement.tags.some((tag) => tag.includes(token))
}

function buildConstructionAddMapDiff(input: {
  input: ConstructionExecutionInput
  placement: MapPlacement
  executableStage: ConstructionStageType
}): MapDiff {
  return {
    id: [
      "construction-add",
      normalizeIdToken(input.input.plan.id),
      input.executableStage,
      `tick-${input.input.worldDay ?? "unknown"}`,
      normalizeIdToken(input.placement.id),
    ].join("-"),
    operation: "add",
    placementId: input.placement.id,
    placement: input.placement,
    reason: buildMapDiffReason({
      plan: input.input.plan,
      executableStage: input.executableStage,
    }),
    createdAt: input.input.now,
    tags: buildMapDiffTags({
      plan: input.input.plan,
      executableStage: input.executableStage,
      operation: "add",
    }),
  }
}

function buildConstructionUpdateMapDiff(input: {
  input: ConstructionExecutionInput
  placement: MapPlacement
  executableStage: ConstructionStageType
  index: number
}): MapDiff {
  return {
    id: [
      "construction-candidate",
      normalizeIdToken(input.input.plan.id),
      input.executableStage,
      `tick-${input.input.worldDay ?? "unknown"}`,
      normalizeIdToken(input.placement.id),
      String(input.index),
    ].join("-"),
    operation: "update",
    placementId: input.placement.id,
    patch: {
      alpha: buildUpdatedAlpha(input.placement.alpha),
      tags: buildUpdatedPlacementTags({
        placement: input.placement,
        plan: input.input.plan,
        executableStage: input.executableStage,
      }),
    },
    reason: buildMapDiffReason({
      plan: input.input.plan,
      executableStage: input.executableStage,
    }),
    createdAt: input.input.now,
    tags: buildMapDiffTags({
      plan: input.input.plan,
      executableStage: input.executableStage,
      operation: "update",
    }),
  }
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildUpdatedAlpha(alpha: number): number {
  return Math.min(1, Math.max(0.34, Number((alpha + 0.04).toFixed(2))))
}

function buildUpdatedPlacementTags(input: {
  placement: MapPlacement
  plan: ConstructionPlan
  executableStage: ConstructionStageType
}): string[] {
  return uniqueTags([
    ...input.placement.tags,
    "construction_execution_touched",
    `construction_plan:${input.plan.id}`,
    `construction_project:${input.plan.projectType}`,
    `construction_stage:${input.executableStage}`,
  ])
}

function buildMapDiffReason(input: {
  plan: ConstructionPlan
  executableStage: ConstructionStageType
}): string {
  return [
    input.plan.reason,
    `执行阶段：${input.executableStage}`,
    `目标区域：${input.plan.targetZoneType}`,
  ].join(" / ")
}

function buildMapDiffTags(input: {
  plan: ConstructionPlan
  executableStage: ConstructionStageType
  operation: MapDiff["operation"]
}): string[] {
  return [
    "construction_execution_candidate",
    `plan:${input.plan.id}`,
    `target:${input.plan.targetZoneType}`,
    `project:${input.plan.projectType}`,
    `stage:${input.executableStage}`,
    `operation:${input.operation}`,
    input.operation === "add"
      ? "butler_adds_construction_fact"
      : "butler_updates_construction_fact",
    "no_direct_home_map_state_mutation",
  ]
}

function buildNextPlan(input: {
  plan: ConstructionPlan
  now: number
  executableStage: ConstructionStageType
  mapDiffIds: string[]
  blockedByResources: boolean
}): ConstructionPlan {
  if (input.blockedByResources) {
    return {
      ...input.plan,
      status: "paused",
      updatedAt: input.now,
      tags: uniqueTags([
        ...input.plan.tags,
        "construction_waiting_for_resources",
        "resource_transaction_blocked",
      ]),
    }
  }

  const nextStages = updateStages({
    stages: input.plan.stages,
    executableStage: input.executableStage,
    mapDiffIds: input.mapDiffIds,
  })
  const executedStage = nextStages.find(
    (stage) => stage.type === input.executableStage
  )
  const currentStage =
    executedStage && executedStage.completed
      ? getNextStage(input.executableStage)
      : input.executableStage

  return {
    ...input.plan,
    status: currentStage === "completed" ? "completed" : "active",
    currentStage,
    stages: nextStages,
    updatedAt: input.now,
    tags: uniqueTags([
      ...input.plan.tags,
      "construction_execution_candidate_plan",
      "map_diff_candidate_generated",
    ]),
  }
}

function updateStages(input: {
  stages: ConstructionStage[]
  executableStage: ConstructionStageType
  mapDiffIds: string[]
}): ConstructionStage[] {
  return input.stages.map((stage) => {
    if (stage.type !== input.executableStage) return stage

    const progress = Math.min(
      100,
      stage.progress + (input.mapDiffIds.length > 0 ? STAGE_PROGRESS_INCREMENT : 0)
    )

    return {
      ...stage,
      progress,
      mapDiffIds: uniqueTags([...stage.mapDiffIds, ...input.mapDiffIds]),
      completed: progress >= 100,
    }
  })
}

function getNextStage(stage: ConstructionStageType): ConstructionStageType {
  const currentIndex = STAGE_ORDER.indexOf(stage)
  if (currentIndex < 0) return "planned"

  return STAGE_ORDER[Math.min(currentIndex + 1, STAGE_ORDER.length - 1)]
}

function buildExecutionMessages(input: {
  input: ConstructionExecutionInput
  mapDiffs: MapDiff[]
}): string[] {
  const blockedTransactions = input.input.plan.resourceRequests.filter((request) => {
    const resource = input.input.homeMapState.resources.resourcePoolState?.resources[
      request.resourceKey
    ]

    return resource ? resource.current + request.amount < resource.min : false
  })

  if (blockedTransactions.length > 0) {
    return [
      `建设计划 ${input.input.plan.id} 因资源不足暂停，未生成 MapDiff。`,
      ...blockedTransactions.map(
        (request) => `资源不足：${request.resourceKey} / ${request.amount}`
      ),
    ]
  }

  if (input.input.plan.currentStage === "completed") {
    return ["建设计划已经处于完成阶段，本轮不生成新的 MapDiff 候选。"]
  }

  if (input.input.plan.projectType === "prepare_future_expansion") {
    return ["未来扩展计划当前只记录观察判断，不生成新的世界对象或 MapDiff 候选。"]
  }

  if (input.mapDiffs.length === 0) {
    return [
      `未找到可执行的已有 placement：${input.input.plan.projectType} / ${input.input.plan.targetZoneType}。`,
    ]
  }

  const addCount = input.mapDiffs.filter((diff) => diff.operation === "add").length
  if (addCount > 0) {
    return [
      `管家根据资源交易和建设计划生成 ${addCount} 个新增 MapDiff 候选。`,
      "新增对象仍需通过 SafeApply 审计后才能进入 HomeMapState。",
    ]
  }

  return [
    `已为 ${input.input.plan.title} 生成 ${input.mapDiffs.length} 个 MapDiff 候选。`,
  ]
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags))
}
