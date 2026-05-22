/**
 * 当前文件职责：提供 MVP 持久化 dry-run。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export type MvpPersistenceMode = "memory_commit" | "memory_preview" | "disabled"

export type MvpPersistenceDryRunInput = {
  mode: MvpPersistenceMode
  baseHomeMapState: HomeMapState
  nextHomeMapState: HomeMapState
  acceptedDiffIds: string[]
  warnings: string[]
  tags: string[]
}

export type MvpPersistenceDryRunResult = {
  mode: MvpPersistenceMode
  canPersist: boolean
  didPersistInMemory: boolean
  committedHomeMapState: HomeMapState | null
  previewHomeMapState: HomeMapState | null
  reason: string
  stablePersistenceFingerprint: string
  warnings: string[]
  messages: string[]
  tags: string[]
}

export function runMvpPersistenceDryRun(
  input: MvpPersistenceDryRunInput
): MvpPersistenceDryRunResult {
  const warnings = [
    ...input.warnings,
    ...auditLineage(input.baseHomeMapState, input.nextHomeMapState),
  ]
  const canPersist =
    input.mode !== "disabled" &&
    warnings.length === 0 &&
    input.acceptedDiffIds.length > 0
  const didPersistInMemory = input.mode === "memory_commit" && canPersist

  return {
    mode: input.mode,
    canPersist,
    didPersistInMemory,
    committedHomeMapState: didPersistInMemory ? input.nextHomeMapState : null,
    previewHomeMapState:
      input.mode === "memory_preview" && canPersist
        ? input.nextHomeMapState
        : null,
    reason: buildReason({
      mode: input.mode,
      canPersist,
      warningCount: warnings.length,
      acceptedDiffCount: input.acceptedDiffIds.length,
    }),
    stablePersistenceFingerprint: [
      input.baseHomeMapState.worldId,
      input.baseHomeMapState.ownerId,
      input.baseHomeMapState.seed,
      input.mode,
      input.acceptedDiffIds.slice().sort().join("+"),
      String(input.nextHomeMapState.updatedAt),
    ].join("::"),
    warnings,
    messages: warnings.length === 0 ? ["MVP persistence dry-run passed."] : warnings,
    tags: [
      "mvp_persistence_dry_run",
      "no_real_storage_write",
      `mode:${input.mode}`,
      ...input.tags,
    ],
  }
}

function auditLineage(base: HomeMapState, next: HomeMapState): string[] {
  const warnings: string[] = []

  if (base.worldId !== next.worldId) warnings.push("Persistence 不能改变 worldId。")
  if (base.ownerId !== next.ownerId) warnings.push("Persistence 不能改变 ownerId。")
  if (base.seed !== next.seed) warnings.push("Persistence 不能改变 seed。")

  return warnings
}

function buildReason(input: {
  mode: MvpPersistenceMode
  canPersist: boolean
  warningCount: number
  acceptedDiffCount: number
}): string {
  if (input.mode === "disabled") return "MVP persistence disabled."
  if (input.canPersist) {
    return `MVP persistence ${input.mode} ready with ${input.acceptedDiffCount} accepted diffs.`
  }
  if (input.warningCount > 0) return "MVP persistence blocked by warnings."

  return "MVP persistence skipped because there are no accepted diffs."
}
