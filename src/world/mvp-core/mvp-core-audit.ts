/**
 * 当前文件职责：审计 MVP 核心 debug runner 的完整 dry-run 输出。
 */

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import type {
  MvpCoreAudit,
  MvpCoreDebugRunnerInput,
  MvpCoreDebugRunnerResult,
} from "./mvp-core-schema"

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
    ...result.lifeEventResult.audit.warnings.map(
      (warning) => `LifeEvent warning: ${warning}`
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
    input.resultWithoutAudit.lifeEventResult.audit.stableLifeEventFingerprint,
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
