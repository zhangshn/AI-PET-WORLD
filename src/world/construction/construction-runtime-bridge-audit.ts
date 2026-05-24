/**
 * 当前文件职责：审计建设纵向闭环进入运行时桥接层之前的边界。
 */
// These tokens are only V2.6 redline audit checks. They do not mean the current product supports these old routes.

import type { MapPlacement } from "@/world/map-state/home-map-state-schema"

import type {
  ConstructionRuntimeBridgeAudit,
  ConstructionRuntimeBridgeInput,
  ConstructionRuntimeVerticalSliceResult,
} from "./construction-schema"

// These tokens are only used for V2.6 redline audit scans. They do not mean the current product supports these old routes.
const FORBIDDEN_RUNTIME_BRIDGE_TOKENS = [
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

export function auditConstructionRuntimeBridge(input: {
  bridgeInput: ConstructionRuntimeBridgeInput
  verticalSliceResult: ConstructionRuntimeVerticalSliceResult
}): ConstructionRuntimeBridgeAudit {
  const warnings = [
    ...auditLineage(input),
    ...auditVerticalSlice(input.verticalSliceResult),
    ...auditForbiddenTokens(input),
  ]

  return {
    stableRuntimeBridgeFingerprint: buildStableRuntimeBridgeFingerprint(input),
    bridgeId: input.bridgeInput.bridgeId,
    worldId: input.bridgeInput.homeMapState.worldId,
    ownerId: input.bridgeInput.homeMapState.ownerId,
    selectedPlanId:
      input.verticalSliceResult.runtimeCycleResult.audit.selectedPlanId,
    warnings,
    tags: [
      "construction_runtime_bridge_audit",
      warnings.length === 0
        ? "construction_runtime_bridge_valid"
        : "construction_runtime_bridge_warning",
      "no_world_loop_registration",
      "no_real_persistence",
      "no_ui_render",
    ],
  }
}

function auditLineage(input: {
  bridgeInput: ConstructionRuntimeBridgeInput
  verticalSliceResult: ConstructionRuntimeVerticalSliceResult
}): string[] {
  const before = input.bridgeInput.homeMapState
  const after = input.verticalSliceResult.nextHomeMapState
  const warnings: string[] = []

  if (before.worldId !== after.worldId) {
    warnings.push("RuntimeBridge 不能改变 worldId。")
  }
  if (before.ownerId !== after.ownerId) {
    warnings.push("RuntimeBridge 不能改变 ownerId。")
  }
  if (before.seed !== after.seed) {
    warnings.push("RuntimeBridge 不能改变 seed。")
  }

  return warnings
}

function auditVerticalSlice(
  verticalSliceResult: ConstructionRuntimeVerticalSliceResult
): string[] {
  return [
    ...verticalSliceResult.fullPipelineAudit.warnings.map(
      (warning) => `VerticalSlice warning: ${warning}`
    ),
    ...verticalSliceResult.runtimeCycleResult.audit.warnings.map(
      (warning) => `RuntimeCycle warning: ${warning}`
    ),
  ]
}

function auditForbiddenTokens(input: {
  bridgeInput: ConstructionRuntimeBridgeInput
  verticalSliceResult: ConstructionRuntimeVerticalSliceResult
}): string[] {
  const tokens = [
    input.bridgeInput.bridgeId,
    ...input.bridgeInput.tags,
    ...input.verticalSliceResult.messages,
    ...input.verticalSliceResult.tags,
    ...input.verticalSliceResult.nextHomeMapState.placements.flatMap(
      collectPlacementTokens
    ),
  ].map((token) => token.toLowerCase())

  return FORBIDDEN_RUNTIME_BRIDGE_TOKENS.flatMap((token) =>
    tokens.some((item) => item.includes(token))
      ? [`RuntimeBridge 包含禁止 token：${token}`]
      : []
  )
}

function buildStableRuntimeBridgeFingerprint(input: {
  bridgeInput: ConstructionRuntimeBridgeInput
  verticalSliceResult: ConstructionRuntimeVerticalSliceResult
}): string {
  return [
    input.bridgeInput.bridgeId,
    input.bridgeInput.homeMapState.worldId,
    input.bridgeInput.homeMapState.ownerId,
    input.bridgeInput.homeMapState.seed,
    String(input.bridgeInput.now),
    input.bridgeInput.runReason,
    input.verticalSliceResult.fullPipelineAudit.stablePipelineFingerprint,
    fingerprintPlacements(input.verticalSliceResult.nextHomeMapState.placements),
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
