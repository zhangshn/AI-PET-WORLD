/**
 * 当前文件职责：构建 MVP 世界闭环 runtime 初始状态与单步推进结果。
 */

import { buildEnvironmentStateFromHomeMap } from "@/world/environment/environment-gateway"
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
  buildRenderableWorldSnapshot,
  buildVisualState,
} from "@/world/rendering/renderer-gateway"
import { buildWorldEngineChainAuditReport } from "@/world/world-engine-chain-audit/world-engine-chain-audit-gateway"
import { buildWorldEvolutionAuditReport } from "@/world/world-evolution-audit/world-evolution-audit-gateway"
import { buildWorldEvolutionExecution } from "@/world/world-evolution-executor/world-evolution-executor-gateway"
import {
  buildWorldChangePlan,
  buildWorldDiffProposal,
} from "@/world/world-evolution/world-evolution-gateway"

import {
  buildSafeApplyDecision,
  type SafeApplyDecision,
} from "./safe-apply-policy"
import type {
  ApplyWorldLoopStepInput,
  BuildRuntimeWorldStateInput,
  BuildWorldLoopStepInput,
  RuntimeWorldState,
  WorldLoopAuditTrail,
  WorldLoopContext,
  WorldLoopRenderableState,
  WorldLoopStageName,
  WorldLoopStageRecord,
  WorldLoopStepResult,
  WorldLoopStepStatus,
} from "./world-loop-schema"

export function buildRuntimeWorldState(
  input: BuildRuntimeWorldStateInput
): RuntimeWorldState {
  const tickId = `world-loop-tick-initial-${input.worldId}-${input.now}`

  return {
    worldId: input.worldId,
    ownerId: input.ownerId,
    tickIndex: 0,
    currentHomeMapState: input.initialHomeMapState,
    currentRenderableSnapshot: input.initialRenderableSnapshot,
    auditTrail: [
      {
        id: `world-loop-audit-initial-${input.worldId}-${input.now}`,
        tickId,
        checkedAt: input.now,
        stages: [
          {
            stage: "runtime_input",
            status: "rendered",
            message:
              "RuntimeWorldState 已根据初始 HomeMapState 与 RenderableWorldSnapshot 建立。",
            tags: ["world_loop_stage", "runtime_input", "initial_world"],
          },
        ],
        blockers: [],
        warnings: [],
        notes: [
          "初始 RuntimeWorldState 不执行 world-evolution，仅承接第一幕世界事实。",
        ],
        tags: ["world_loop_audit_v0", "initial_world"],
      },
    ],
    tags: ["runtime_world_state_v0", "initial_world"],
  }
}

export function buildWorldLoopStep(
  input: BuildWorldLoopStepInput
): WorldLoopStepResult {
  const previousHomeMapState = input.runtimeState.currentHomeMapState
  const tickIndex = input.runtimeState.tickIndex + 1
  const context: WorldLoopContext = {
    worldId: input.runtimeState.worldId,
    ownerId: input.runtimeState.ownerId,
    tickId: `world-loop-tick-${input.runtimeState.worldId}-${tickIndex}-${input.now}`,
    tickIndex,
    now: input.now,
    source: input.source,
    tags: ["world_loop_context_v0", `source:${input.source}`],
  }

  const environmentState = buildEnvironmentStateFromHomeMap({
    homeMapState: previousHomeMapState,
    generatedAt: input.now,
  })
  const placementGeometryAudit = buildPlacementGeometryAuditReport({
    homeMapState: previousHomeMapState,
    checkedAt: input.now,
  })
  const intentDecision = buildButlerIntentDecision({
    butler: input.butlerIntentContext ?? buildDefaultButlerIntentContext(),
    pet: input.petIntentContext ?? buildDefaultPetIntentContext(),
    environment: environmentState,
    world: buildWorldIntentContext({
      runtimeState: input.runtimeState,
      homeMapState: previousHomeMapState,
      context,
    }),
  })
  const worldChangePlan = buildWorldChangePlan({
    homeMapState: previousHomeMapState,
    environment: environmentState,
    decision: intentDecision,
    now: input.now,
  })
  const worldDiffProposal = buildWorldDiffProposal({
    homeMapState: previousHomeMapState,
    plan: worldChangePlan,
    now: input.now,
  })
  const worldDiffValidation = validateMapDiffs({
    homeMapState: previousHomeMapState,
    mapDiffs: worldDiffProposal.mapDiffs,
  })
  const worldEvolutionAudit = buildWorldEvolutionAuditReport({
    checkedAt: input.now,
    decision: intentDecision,
    plan: worldChangePlan,
    proposal: worldDiffProposal,
    validation: worldDiffValidation,
  })
  const worldEvolutionExecution = buildWorldEvolutionExecution({
    homeMapState: previousHomeMapState,
    proposal: worldDiffProposal,
    audit: worldEvolutionAudit,
    now: input.now,
  })
  const safeApplyDecision = buildSafeApplyDecision({
    previousHomeMapState,
    proposal: worldDiffProposal,
    validation: worldDiffValidation,
    audit: worldEvolutionAudit,
    execution: worldEvolutionExecution,
  })
  const nextHomeMapState = safeApplyDecision.canUseNextHomeMapState
    ? safeApplyDecision.nextHomeMapState
    : previousHomeMapState
  const worldEngineChainAudit = buildWorldEngineChainAuditReport({
    checkedAt: input.now,
    environment: environmentState,
    decision: intentDecision,
    plan: worldChangePlan,
    proposal: worldDiffProposal,
    validation: worldDiffValidation,
    audit: worldEvolutionAudit,
    execution: worldEvolutionExecution,
  })
  const renderableState = buildWorldLoopRenderableState({
    homeMapState: nextHomeMapState,
    now: input.now,
  })
  const status = mapSafeApplyStatusToStepStatus(safeApplyDecision.status)
  const stages: WorldLoopStageRecord[] = [
    buildStageRecord({
      stage: "runtime_input",
      status: "rendered",
      message: "WorldLoop 已读取当前 RuntimeWorldState。",
      tags: ["runtime_input", `source:${context.source}`],
    }),
    buildStageRecord({
      stage: "environment",
      status: "rendered",
      message: "已根据当前 HomeMapState 派生 EnvironmentState。",
      tags: environmentState.tags,
    }),
    buildStageRecord({
      stage: "geometry_audit",
      status: "rendered",
      message: "已完成 PlacementGeometryAuditReport。",
      tags: ["geometry_audit", `items:${placementGeometryAudit.items.length}`],
    }),
    buildStageRecord({
      stage: "intent",
      status: intentDecision.shouldAct ? "rendered" : "skipped",
      message: intentDecision.decisionReason,
      tags: intentDecision.tags,
    }),
    buildStageRecord({
      stage: "plan",
      status: mapPlanStatusToStepStatus(worldChangePlan.status),
      message: worldChangePlan.reason,
      tags: worldChangePlan.tags,
    }),
    buildStageRecord({
      stage: "proposal",
      status:
        worldDiffProposal.mapDiffs.length > 0 ? "rendered" : "skipped",
      message: worldDiffProposal.reason,
      tags: worldDiffProposal.tags,
    }),
    buildStageRecord({
      stage: "validation",
      status:
        worldDiffValidation.rejectedDiffs.length > 0 ? "blocked" : "rendered",
      message: `MapDiff validation 接受 ${worldDiffValidation.acceptedDiffs.length} 个，拒绝 ${worldDiffValidation.rejectedDiffs.length} 个。`,
      tags: ["validation", "map_diff_validation"],
    }),
    buildStageRecord({
      stage: "audit",
      status:
        worldEvolutionAudit.summary.riskLevel === "high"
          ? "blocked"
          : "rendered",
      message: `WorldEvolutionAudit risk=${worldEvolutionAudit.summary.riskLevel}, canApplySafely=${worldEvolutionAudit.summary.canApplySafely}。`,
      tags: worldEvolutionAudit.tags,
    }),
    buildStageRecord({
      stage: "execution",
      status: mapExecutionStatusToStepStatus(worldEvolutionExecution.status),
      message: `WorldEvolutionExecution status=${worldEvolutionExecution.status}，应用 MapDiff 数量 ${worldEvolutionExecution.appliedMapDiffCount}。`,
      tags: worldEvolutionExecution.tags,
    }),
    safeApplyDecision.stageRecord,
    buildStageRecord({
      stage: "renderable_snapshot",
      status: "rendered",
      message: "已根据 nextHomeMapState 派生 RenderableWorldSnapshot。",
      tags: renderableState.tags,
    }),
  ]
  const auditTrail = buildWorldLoopAuditTrail({
    context,
    status,
    safeApplyDecision,
    stages,
    blockers: flattenUnique([
      ...intentDecision.selectedIntent.blockers,
      ...worldChangePlan.blockers,
      ...worldEvolutionAudit.blockers,
      ...worldEvolutionExecution.blockedReasons,
      ...worldEngineChainAudit.blockers,
    ]),
    warnings: flattenUnique([
      ...worldDiffProposal.warnings,
      ...worldDiffValidation.warnings,
      ...worldEvolutionAudit.warnings,
      ...worldEngineChainAudit.warnings,
    ]),
    notes: flattenUnique([
      intentDecision.decisionReason,
      worldEngineChainAudit.summary.blockedAt !== "none"
        ? `WorldEngineChainAudit 阻塞在 ${worldEngineChainAudit.summary.blockedAt}。`
        : "",
      ...worldEvolutionAudit.notes,
      ...worldEvolutionExecution.messages,
      ...worldEngineChainAudit.notes,
    ]),
  })

  return {
    id: `world-loop-step-${context.tickId}`,
    context,
    status,
    previousHomeMapState,
    nextHomeMapState,
    environmentState,
    placementGeometryAudit,
    intentDecision,
    worldChangePlan,
    worldDiffProposal,
    worldDiffValidation,
    worldEvolutionAudit,
    worldEvolutionExecution,
    worldEngineChainAudit,
    renderableState,
    auditTrail,
    tags: [
      "world_loop_step_v0",
      `status:${status}`,
      `source:${context.source}`,
      `safe_apply:${safeApplyDecision.status}`,
    ],
  }
}

export function applyWorldLoopStep(
  input: ApplyWorldLoopStepInput
): RuntimeWorldState {
  return {
    ...input.runtimeState,
    tickIndex: input.stepResult.context.tickIndex,
    currentHomeMapState: input.stepResult.nextHomeMapState,
    currentRenderableSnapshot:
      input.stepResult.renderableState.renderableWorldSnapshot,
    lastStepResult: input.stepResult,
    auditTrail: [...input.runtimeState.auditTrail, input.stepResult.auditTrail],
    tags: Array.from(
      new Set([
        ...input.runtimeState.tags,
        "runtime_world_state_v0",
        "world_loop_step_applied",
        `last_status:${input.stepResult.status}`,
      ])
    ),
  }
}

function buildWorldLoopRenderableState(input: {
  homeMapState: HomeMapState
  now: number
}): WorldLoopRenderableState {
  const environmentState = buildEnvironmentStateFromHomeMap({
    homeMapState: input.homeMapState,
    generatedAt: input.now,
  })
  const placementGeometryAudit = buildPlacementGeometryAuditReport({
    homeMapState: input.homeMapState,
    checkedAt: input.now,
  })
  const visualState = buildVisualState({
    homeMapState: input.homeMapState,
    environmentState,
    placementGeometryAudit,
    generatedAt: input.now,
  })
  const renderableWorldSnapshot = buildRenderableWorldSnapshot({
    visualState,
  })

  return {
    homeMapState: input.homeMapState,
    environmentState,
    placementGeometryAudit,
    renderableWorldSnapshot,
    tags: [
      "world_loop_renderable_state_v0",
      ...renderableWorldSnapshot.tags,
    ],
  }
}

function buildDefaultButlerIntentContext(): ButlerIntentContext {
  return {
    mood: "focused",
    currentTask: "observe_home",
    constructionStyle: {
      structuredBuilder: 50,
      warmCaretaker: 55,
      protectiveKeeper: 50,
      aestheticOrganizer: 50,
      quietMaintainer: 50,
      adaptivePlanner: 55,
    },
    tags: ["world_loop_default_butler_context"],
  }
}

function buildDefaultPetIntentContext(): PetIntentContext {
  return {
    energy: 60,
    hunger: 35,
    mood: "stable",
    currentZoneType: "initial_care",
    recentAction: "observing",
    tags: ["world_loop_default_pet_context"],
  }
}

function buildWorldIntentContext(input: {
  runtimeState: RuntimeWorldState
  homeMapState: HomeMapState
  context: WorldLoopContext
}): WorldIntentContext {
  return {
    worldTick: input.context.tickIndex,
    spacePressure: input.homeMapState.resources.spacePressure,
    constructionPlanCount: input.homeMapState.constructionPlans.length,
    activeConstructionPlanCount: input.homeMapState.constructionPlans.filter(
      (plan) => plan.status === "active"
    ).length,
    tags: [
      "world_loop_world_context",
      `source:${input.context.source}`,
      `tick:${input.context.tickIndex}`,
      `runtime_tick:${input.runtimeState.tickIndex}`,
    ],
  }
}

function buildWorldLoopAuditTrail(input: {
  context: WorldLoopContext
  status: WorldLoopStepStatus
  safeApplyDecision: SafeApplyDecision
  stages: WorldLoopStageRecord[]
  blockers: string[]
  warnings: string[]
  notes: string[]
}): WorldLoopAuditTrail {
  return {
    id: `world-loop-audit-${input.context.tickId}`,
    tickId: input.context.tickId,
    checkedAt: input.context.now,
    stages: input.stages,
    blockers: flattenUnique([
      ...input.blockers,
      ...input.safeApplyDecision.blockers,
    ]),
    warnings: flattenUnique([
      ...input.warnings,
      ...input.safeApplyDecision.warnings,
    ]),
    notes: flattenUnique([...input.notes, ...input.safeApplyDecision.reasons]),
    tags: [
      "world_loop_audit_v0",
      `status:${input.status}`,
      `safe_apply:${input.safeApplyDecision.status}`,
    ],
  }
}

function buildStageRecord(input: {
  stage: WorldLoopStageName
  status: WorldLoopStepStatus
  message: string
  tags: string[]
}): WorldLoopStageRecord {
  return {
    stage: input.stage,
    status: input.status,
    message: input.message,
    tags: ["world_loop_stage", ...input.tags],
  }
}

function flattenUnique(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  )
}

function mapSafeApplyStatusToStepStatus(
  status: SafeApplyDecision["status"]
): WorldLoopStepStatus {
  if (status === "allow_apply") return "rendered"
  if (status === "skip_no_diff") return "skipped"

  return "blocked"
}

function mapPlanStatusToStepStatus(
  status: "proposed" | "blocked" | "skipped"
): WorldLoopStepStatus {
  if (status === "blocked") return "blocked"
  if (status === "skipped") return "skipped"

  return "rendered"
}

function mapExecutionStatusToStepStatus(
  status: "applied" | "blocked" | "skipped"
): WorldLoopStepStatus {
  if (status === "applied") return "applied"
  if (status === "skipped") return "skipped"

  return "blocked"
}
