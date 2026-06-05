/**
 * Audits world runtime construction tick output.
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export type WorldRuntimeConstructionAudit = {
  stableRuntimeFingerprint: string
  worldId: string
  warnings: string[]
  tags: string[]
}

export function auditWorldRuntimeConstructionTick(result: {
  inputHomeMapState: HomeMapState
  nextHomeMapState: HomeMapState
  constructionWarnings: string[]
  tickReason: string
}): WorldRuntimeConstructionAudit {
  const warnings = [
    ...auditLineage(result),
    ...result.constructionWarnings.map(
      (warning) => `建设 warning：${warning}`
    ),
  ]

  return {
    stableRuntimeFingerprint: [
      result.inputHomeMapState.worldId,
      result.inputHomeMapState.ownerId,
      result.inputHomeMapState.seed,
      result.tickReason,
      String(result.nextHomeMapState.updatedAt),
      String(result.nextHomeMapState.mapDiffs.length),
    ].join("::"),
    worldId: result.inputHomeMapState.worldId,
    warnings,
    tags: [
      "world_runtime_construction_audit",
      warnings.length === 0 ? "world_runtime_construction_valid" : "world_runtime_construction_warning",
      "safe_apply_lineage_required",
    ],
  }
}

function auditLineage(result: {
  inputHomeMapState: HomeMapState
  nextHomeMapState: HomeMapState
}): string[] {
  const warnings: string[] = []

  if (result.inputHomeMapState.worldId !== result.nextHomeMapState.worldId) {
    warnings.push("Runtime tick 不能修改 worldId。")
  }
  if (result.inputHomeMapState.ownerId !== result.nextHomeMapState.ownerId) {
    warnings.push("Runtime tick 不能修改 ownerId。")
  }
  if (result.inputHomeMapState.seed !== result.nextHomeMapState.seed) {
    warnings.push("Runtime tick 不能修改 seed。")
  }

  return warnings
}
