/**
 * 当前文件职责：串联 MVP 核心链路的 debug dry-run 入口。
 */

import { buildConstructionPersistenceAdapterDryRunResult } from "@/world/construction/construction-persistence-adapter"
import { buildConstructionRuntimeBridgeResult } from "@/world/construction/construction-runtime-bridge"
import {
  buildConstructionFormalVisualRefreshPrecheck,
  buildConstructionSnapshotRefreshRequest,
} from "@/world/construction/construction-snapshot-refresh-request"
import { buildTownAdoptionPrecheckBuilderResult } from "@/world/adoption/town-adoption-candidate-builder"

import { auditMvpCoreDebugRunner } from "./mvp-core-audit"
import { buildMvpCoreReport } from "./mvp-core-report"
import type {
  MvpCoreDebugRunnerInput,
  MvpCoreDebugRunnerResult,
} from "./mvp-core-schema"

export function runMvpCoreDebugRunner(
  input: MvpCoreDebugRunnerInput
): MvpCoreDebugRunnerResult {
  const constructionBridgeResult = buildConstructionRuntimeBridgeResult({
    homeMapState: input.homeMapState,
    constructionStyle: input.constructionStyle,
    worldDay: input.worldDay,
    now: input.now,
    preferredPlanId: input.preferredPlanId,
    runReason: "manual_debug",
    persistenceMode: "proposal_only",
    visualRefreshMode: "signal_only",
    memoryPersistenceMode: "memory_preview",
    bridgeId: buildBridgeId(input),
    tags: [
      ...input.tags,
      "mvp_core_debug_runner",
      "debug_dry_run_only",
    ],
  })
  const persistenceDryRunResult =
    buildConstructionPersistenceAdapterDryRunResult({
      proposal:
        constructionBridgeResult.verticalSliceResult.runtimeCycleResult
          .persistenceProposal,
      runtimeBridgeAudit: constructionBridgeResult.audit,
    })
  const snapshotRefreshRequest = buildConstructionSnapshotRefreshRequest({
    worldId: input.homeMapState.worldId,
    ownerId: input.homeMapState.ownerId,
    visualRefreshBridgeResult:
      constructionBridgeResult.verticalSliceResult.visualRefreshBridgeResult,
    upstreamWarnings: [
      ...constructionBridgeResult.audit.warnings,
      ...persistenceDryRunResult.audit.warnings,
    ],
  })
  const formalVisualRefreshPrecheck =
    buildConstructionFormalVisualRefreshPrecheck({
      request: snapshotRefreshRequest,
    })
  const townAdoptionResult = buildTownAdoptionPrecheckBuilderResult({
    homeMapState:
      constructionBridgeResult.verticalSliceResult.nextHomeMapState,
    constructionBridgeResult,
    now: input.now,
    tags: [
      ...input.tags,
      "mvp_core_town_adoption_precheck_observation",
    ],
  })
  const resultWithoutAuditAndReport: Omit<
    MvpCoreDebugRunnerResult,
    "audit" | "report"
  > = {
    constructionBridgeResult,
    persistenceDryRunResult,
    snapshotRefreshRequest,
    formalVisualRefreshPrecheck,
    townAdoptionResult,
    messages: [
      ...constructionBridgeResult.messages,
      persistenceDryRunResult.rejectedReason ??
        "Persistence adapter dry-run is ready.",
      snapshotRefreshRequest.reason,
      formalVisualRefreshPrecheck.reason,
      ...townAdoptionResult.messages,
    ],
    tags: [
      "mvp_core_debug_runner_result",
      "debug_dry_run_only",
      "no_ui_render",
      "no_real_persistence",
      "no_world_loop_registration",
      "town_adoption_deferred_only",
    ],
  }
  const audit = auditMvpCoreDebugRunner({
    runnerInput: input,
    resultWithoutAudit: resultWithoutAuditAndReport,
  })
  const report = buildMvpCoreReport({
    resultWithoutReport: {
      ...resultWithoutAuditAndReport,
      audit,
    },
    audit,
  })

  return {
    ...resultWithoutAuditAndReport,
    audit,
    report,
  }
}

function buildBridgeId(input: MvpCoreDebugRunnerInput): string {
  return [
    "mvp-core-construction-bridge",
    normalizeIdToken(input.homeMapState.worldId),
    String(input.now),
  ].join("-")
}

function normalizeIdToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
