/**
 * 当前文件职责：审计 MVP 核心 debug runner 的完整 dry-run 输出。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import type {
  AiPetWorldMvpAudit,
  AiPetWorldMvpPipelineResult,
  MvpCoreAudit,
  MvpCoreDebugRunnerInput,
  MvpCoreDebugRunnerResult,
} from "./mvp-core-schema"

export function auditMvpCoreDebugRunner(input: {
  runnerInput: MvpCoreDebugRunnerInput
  resultWithoutAudit: Omit<MvpCoreDebugRunnerResult, "audit" | "report">
}): MvpCoreAudit {
  const warnings = [
    ...auditLineage(input),
    ...auditNestedWarnings(input.resultWithoutAudit),
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
      "mvp_pipeline_fact_fingerprint",
    ],
  }
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
