/**
 * 当前文件职责：审计 MVP 核心 debug runner 的完整 dry-run 输出。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import type {
  AiPetWorldMvpAudit,
  AiPetWorldMvpPipelineResult,
  MvpCoreAudit,
  MvpCoreDebugRunnerInput,
  MvpCoreDebugRunnerResult,
} from "./mvp-core-schema"

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
const FORBIDDEN_MVP_CORE_TOKENS = [
  "pet_arrival",
  "pet_rest",
  "pet-near-arrival-point",
  "pet-bed",
  "pet_actor",
  "incubator",
  "embryo",
  "hatching",
  "incubating",
]

export function auditMvpCoreDebugRunner(input: {
  runnerInput: MvpCoreDebugRunnerInput
  resultWithoutAudit: Omit<MvpCoreDebugRunnerResult, "audit" | "report">
}): MvpCoreAudit {
  const warnings = [
    ...auditLineage(input),
    ...auditNestedWarnings(input.resultWithoutAudit),
    ...auditForbiddenTokens(input),
  ]

  return {
    stableMvpCoreFingerprint: buildStableMvpCoreFingerprint(input),
    worldId: input.runnerInput.homeMapState.worldId,
    ownerId: input.runnerInput.homeMapState.ownerId,
    warnings,
    tags: [
      "mvp_core_debug_runner_audit",
      warnings.length === 0 ? "mvp_core_valid" : "mvp_core_warning",
      "debug_dry_run_only",
      "no_ui_render",
      "no_real_persistence",
    ],
  }
}

export function auditAiPetWorldMvpPipeline(
  result: AiPetWorldMvpPipelineResult
): AiPetWorldMvpAudit {
  const warnings = [
    ...result.butlerAudit.warnings,
    ...result.initialWorld.audit.warnings,
    ...result.runtimeTick.audit.warnings,
    ...result.persistence.warnings,
    ...result.visualRefresh.warnings,
    ...result.formalVisualRefresh.warnings,
    ...result.adoptionOpportunityObservations.flatMap((candidate) =>
      candidate.readyForButlerAdoptionIntent && candidate.kind !== "adoption_opportunity_later"
        ? [`Unexpected adoption opportunity readiness: ${candidate.observationId}`]
        : []
    ),
    ...auditPipelineForbiddenTokens(result),
  ]

  return {
    stableMvpFingerprint: [
      result.butlerAudit.stableButlerFingerprint,
      result.initialWorld.audit.stableInitialWorldFingerprint,
      result.runtimeTick.audit.stableRuntimeFingerprint,
      result.persistence.stablePersistenceFingerprint,
      result.visualRefresh.snapshotRefreshRequestId,
      result.formalVisualRefresh.formalVisualModel?.worldId ?? "no-formal-model",
      result.worldLogs.map((log) => log.id).sort().join("+"),
    ].join("::"),
    worldId: result.nextHomeMapState.worldId,
    ownerId: result.nextHomeMapState.ownerId,
    warnings,
    tags: [
      "ai_pet_world_mvp_audit",
      warnings.length === 0 ? "ai_pet_world_mvp_valid" : "ai_pet_world_mvp_warning",
      "no_default_adoption_entry",
    ],
  }
}

function auditPipelineForbiddenTokens(
  result: AiPetWorldMvpPipelineResult
): string[] {
  const tokens = [
    ...result.tags,
    ...result.messages,
    ...result.worldLogs.flatMap((log) => [log.id, log.title, log.body, ...log.tags]),
    ...result.butlerExplanations.flatMap((item) => [
      item.id,
      item.title,
      item.body,
      ...item.tags,
    ]),
    ...result.nextHomeMapState.placements.flatMap(collectPlacementTokens),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_MVP_CORE_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`AI-PET-WORLD MVP pipeline 包含禁止 token：${token}`]
      : []
  )
}

function auditLineage(input: {
  runnerInput: MvpCoreDebugRunnerInput
  resultWithoutAudit: Omit<MvpCoreDebugRunnerResult, "audit" | "report">
}): string[] {
  const before = input.runnerInput.homeMapState
  const after =
    input.resultWithoutAudit.constructionBridgeResult.verticalSliceResult
      .nextHomeMapState
  const warnings: string[] = []

  if (before.worldId !== after.worldId) {
    warnings.push("MVP core runner 不能改变 worldId。")
  }
  if (before.ownerId !== after.ownerId) {
    warnings.push("MVP core runner 不能改变 ownerId。")
  }
  if (before.seed !== after.seed) {
    warnings.push("MVP core runner 不能改变 seed。")
  }

  return warnings
}

function auditNestedWarnings(
  result: Omit<MvpCoreDebugRunnerResult, "audit" | "report">
): string[] {
  return [
    ...result.constructionBridgeResult.audit.warnings.map(
      (warning) => `RuntimeBridge warning: ${warning}`
    ),
    ...result.persistenceDryRunResult.audit.warnings.map(
      (warning) => `Persistence dry-run warning: ${warning}`
    ),
    ...result.formalVisualRefreshPrecheck.audit.warnings.map(
      (warning) => `Snapshot refresh warning: ${warning}`
    ),
    ...result.townAdoptionResult.audit.warnings.map(
      (warning) => `TownAdoptionPrecheck warning: ${warning}`
    ),
  ]
}

function auditForbiddenTokens(input: {
  runnerInput: MvpCoreDebugRunnerInput
  resultWithoutAudit: Omit<MvpCoreDebugRunnerResult, "audit" | "report">
}): string[] {
  const nextHomeMapState =
    input.resultWithoutAudit.constructionBridgeResult.verticalSliceResult
      .nextHomeMapState
  const tokens = [
    ...input.runnerInput.tags,
    ...input.resultWithoutAudit.messages,
    ...input.resultWithoutAudit.tags,
    ...nextHomeMapState.placements.flatMap(collectPlacementTokens),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_MVP_CORE_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`MVP core runner 包含禁止 token：${token}`]
      : []
  )
}

function buildStableMvpCoreFingerprint(input: {
  runnerInput: MvpCoreDebugRunnerInput
  resultWithoutAudit: Omit<MvpCoreDebugRunnerResult, "audit" | "report">
}): string {
  const nextHomeMapState =
    input.resultWithoutAudit.constructionBridgeResult.verticalSliceResult
      .nextHomeMapState

  return [
    input.runnerInput.homeMapState.worldId,
    input.runnerInput.homeMapState.ownerId,
    input.runnerInput.homeMapState.seed,
    String(input.runnerInput.now),
    input.resultWithoutAudit.constructionBridgeResult.audit
      .stableRuntimeBridgeFingerprint,
    input.resultWithoutAudit.persistenceDryRunResult.audit
      .stablePersistenceFingerprint,
    input.resultWithoutAudit.snapshotRefreshRequest.stableRefreshFingerprint,
    input.resultWithoutAudit.townAdoptionResult.audit.stableTownAdoptionFingerprint,
    fingerprintPlacements(nextHomeMapState.placements),
  ].join("::")
}

function fingerprintPlacements(placements: MapPlacement[]): string {
  return placements
    .map((placement) =>
      [
        placement.id,
        placement.layer,
        String(placement.x),
        String(placement.y),
        String(placement.alpha),
        placement.tags.slice().sort().join("+"),
      ].join(":")
    )
    .sort()
    .join("|")
}

function collectPlacementTokens(placement: MapPlacement): string[] {
  return [
    placement.id,
    placement.assetId,
    placement.layer,
    placement.label,
    ...placement.tags,
  ]
}
