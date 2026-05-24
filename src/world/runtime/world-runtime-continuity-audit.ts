/**
 * Continuity audit for repeated live-world runtime actions.
 */

import type { MapDiff } from "@/world/map-state/home-map-state-schema"
import type { ResourceTransaction } from "@/world/resource-cycle/resource-schema"

import type {
  WorldRuntimeSaveRecord,
  WorldRuntimeTickResult,
} from "./world-runtime-schema"

export type WorldRuntimeContinuityAudit = {
  warnings: string[]
  blockingWarnings: string[]
  tags: string[]
}

export function auditWorldRuntimeContinuity(input: {
  previousSaveRecord: WorldRuntimeSaveRecord
  nextSaveRecord: WorldRuntimeSaveRecord
  runtimeTick: NonNullable<WorldRuntimeTickResult["runtimeTick"]>
}): WorldRuntimeContinuityAudit {
  const previousMapDiffCount = input.previousSaveRecord.homeMapState.mapDiffs.length
  const previousPoolTransactionCount =
    input.previousSaveRecord.homeMapState.resources.resourcePoolState?.transactions
      .length ?? 0
  const previousRecentTransactionCount =
    input.previousSaveRecord.homeMapState.resources.recentTransactions?.length ?? 0
  const nextMapDiffs = input.nextSaveRecord.homeMapState.mapDiffs
  const newMapDiffs = nextMapDiffs.slice(previousMapDiffCount)
  const nextPoolTransactions =
    input.nextSaveRecord.homeMapState.resources.resourcePoolState?.transactions ?? []
  const newPoolTransactions = nextPoolTransactions.slice(previousPoolTransactionCount)
  const nextRecentTransactions =
    input.nextSaveRecord.homeMapState.resources.recentTransactions ?? []
  const newRecentTransactions = nextRecentTransactions.slice(
    previousRecentTransactionCount
  )
  const warnings = [
    ...auditRepeatedActionSignatures(input.nextSaveRecord.recentActionSignatures ?? []),
    ...auditDuplicateIds({
      label: "historical MapDiff id",
      values: nextMapDiffs.map((diff) => diff.id),
    }),
    ...auditDuplicateIds({
      label: "historical resourcePoolState transactionId",
      values: nextPoolTransactions.map((transaction) => transaction.transactionId),
    }),
    ...auditDuplicateIds({
      label: "historical recentTransactions transactionId",
      values: nextRecentTransactions.map((transaction) => transaction.transactionId),
    }),
    ...auditRepeatedAddPlacementHistory(nextMapDiffs),
  ]
  const blockingWarnings = [
    ...auditNewDuplicateMapDiffIds({
      previousMapDiffs: input.previousSaveRecord.homeMapState.mapDiffs,
      newMapDiffs,
    }),
    ...auditNewDuplicateTransactionIds({
      label: "resourcePoolState",
      previousTransactions:
        input.previousSaveRecord.homeMapState.resources.resourcePoolState
          ?.transactions ?? [],
      newTransactions: newPoolTransactions,
    }),
    ...auditNewDuplicateTransactionIds({
      label: "recentTransactions",
      previousTransactions:
        input.previousSaveRecord.homeMapState.resources.recentTransactions ?? [],
      newTransactions: newRecentTransactions,
    }),
    ...auditNewRepeatedAddPlacement({
      previousMapDiffs: input.previousSaveRecord.homeMapState.mapDiffs,
      newMapDiffs,
    }),
  ]

  if (
    blockingWarnings.some((warning) => warning.includes("add placement")) &&
    blockingWarnings.some((warning) => warning.includes("transactionId"))
  ) {
    blockingWarnings.push(
      "This tick combined a repeated add placement with duplicated resource deduction."
    )
  }

  return {
    warnings,
    blockingWarnings,
    tags: [
      "world_runtime_continuity_audit",
      blockingWarnings.length === 0
        ? "world_runtime_continuity_persistence_allowed"
        : "world_runtime_continuity_persistence_blocked",
    ],
  }
}

function auditRepeatedActionSignatures(signatures: string[]): string[] {
  const recent = signatures.slice(-3)

  return recent.length === 3 && recent.every((signature) => signature === recent[0])
    ? [`Runtime action signature repeated for the last 3 ticks: ${recent[0]}`]
    : []
}

function auditDuplicateIds(input: {
  label: string
  values: string[]
}): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  input.values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  })

  return Array.from(duplicates).map(
    (value) => `Duplicate ${input.label}: ${value}`
  )
}

function auditRepeatedAddPlacementHistory(mapDiffs: MapDiff[]): string[] {
  const addPlacementIds = mapDiffs
    .filter((diff) => diff.operation === "add")
    .map((diff) => diff.placementId)

  return auditDuplicateIds({
    label: "historical add placementId",
    values: addPlacementIds,
  })
}

function auditNewDuplicateMapDiffIds(input: {
  previousMapDiffs: MapDiff[]
  newMapDiffs: MapDiff[]
}): string[] {
  const previousIds = new Set(input.previousMapDiffs.map((diff) => diff.id))
  const newIds = input.newMapDiffs.map((diff) => diff.id)

  return [
    ...auditDuplicateIds({ label: "new MapDiff id", values: newIds }),
    ...newIds
      .filter((id) => previousIds.has(id))
      .map((id) => `New MapDiff id already existed before this tick: ${id}`),
  ]
}

function auditNewDuplicateTransactionIds(input: {
  label: string
  previousTransactions: ResourceTransaction[]
  newTransactions: ResourceTransaction[]
}): string[] {
  const previousIds = new Set(
    input.previousTransactions.map((transaction) => transaction.transactionId)
  )
  const newIds = input.newTransactions.map((transaction) => transaction.transactionId)

  return [
    ...auditDuplicateIds({
      label: `new ${input.label} transactionId`,
      values: newIds,
    }),
    ...newIds
      .filter((id) => previousIds.has(id))
      .map(
        (id) =>
          `New ${input.label} transactionId already existed before this tick: ${id}`
      ),
  ]
}

function auditNewRepeatedAddPlacement(input: {
  previousMapDiffs: MapDiff[]
  newMapDiffs: MapDiff[]
}): string[] {
  const previousAddPlacementIds = new Set(
    input.previousMapDiffs
      .filter((diff) => diff.operation === "add")
      .map((diff) => diff.placementId)
  )
  const newAddPlacementIds = input.newMapDiffs
    .filter((diff) => diff.operation === "add")
    .map((diff) => diff.placementId)

  return [
    ...auditDuplicateIds({
      label: "new add placementId",
      values: newAddPlacementIds,
    }),
    ...newAddPlacementIds
      .filter((placementId) => previousAddPlacementIds.has(placementId))
      .map(
        (placementId) =>
          `New add placementId already existed before this tick: ${placementId}`
      ),
  ]
}
