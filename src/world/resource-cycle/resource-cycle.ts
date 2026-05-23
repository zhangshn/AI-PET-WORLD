/**
 * 当前文件职责：构建初始资源池并执行可审计资源循环。
 */

import { getBiomeRule, selectBiomeType } from "@/world/ecology/biome-rules"
import type { BiomeType } from "@/world/ecology/ecology-schema"
import type {
  ResourceAudit,
  ResourceCycleInput,
  ResourceCycleResult,
  ResourceKey,
  ResourcePoolState,
  ResourceTransaction,
  ResourceTransactionRequest,
  ResourceValueState,
} from "./resource-schema"

const RESOURCE_KEYS: readonly ResourceKey[] = [
  "groundHealth",
  "naturalGrowth",
  "materialReadiness",
  "careReadiness",
  "spacePressure",
]

export function buildInitialResourcePoolState(input: {
  worldId: string
  regionId: string
  seed: string
  biomeType?: BiomeType
  currentOverrides?: Partial<Record<ResourceKey, number>>
  tags?: string[]
}): ResourcePoolState {
  const biomeType = selectBiomeType({
    requestedBiomeType: input.biomeType,
    seed: input.seed,
  })
  const rule = getBiomeRule(biomeType)
  const resources = RESOURCE_KEYS.reduce(
    (draft, resourceKey) => {
      const resourceRule = rule.resources[resourceKey]
      const current = clampResourceValue(
        input.currentOverrides?.[resourceKey] ?? resourceRule.initial,
        resourceRule.min,
        resourceRule.max
      )

      draft[resourceKey] = {
        resourceKey,
        current,
        min: resourceRule.min,
        max: resourceRule.max,
        regenPerTick: resourceRule.regenPerTick,
        pressure: resourceRule.pressure,
        tags: [...resourceRule.tags, biomeType],
        warnings: [],
      }

      return draft
    },
    {} as Record<ResourceKey, ResourceValueState>
  )
  const transactions = RESOURCE_KEYS.map((resourceKey) =>
    buildResourceTransaction({
      transactionId: `resource-init:${input.worldId}:${resourceKey}`,
      resource: resources[resourceKey],
      amount: 0,
      reason: "Initial resource state materialized from biome rule.",
      source: "initialization",
      tags: ["initial_resource_fact", biomeType],
    })
  )
  const resourcePool: ResourcePoolState = {
    version: "v2_resource_pool_0",
    worldId: input.worldId,
    regionId: input.regionId,
    biomeType,
    resources,
    transactions,
    tags: [
      "resource_pool_state",
      "biome_rule_driven",
      "world_fact_before_visual",
      biomeType,
      ...(input.tags ?? []),
    ],
    warnings: [],
  }

  return {
    ...resourcePool,
    warnings: auditResourcePoolState(resourcePool).warnings,
  }
}

export function runResourceCycle(input: ResourceCycleInput): ResourceCycleResult {
  const regenerationRequests = input.includeNaturalRegeneration === false
    ? []
    : RESOURCE_KEYS.map<ResourceTransactionRequest>((resourceKey) => ({
        transactionId: `${input.cycleId}:regen:${resourceKey}`,
        resourceKey,
        amount: input.resourcePool.resources[resourceKey].regenPerTick,
        reason: input.reason,
        source: input.source ?? "natural_regeneration",
        tags: ["natural_regeneration", ...(input.tags ?? [])],
      }))
  const requests = [...regenerationRequests, ...(input.requests ?? [])]

  return applyResourceTransactions({
    resourcePool: input.resourcePool,
    cycleId: input.cycleId,
    requests,
    tags: input.tags,
  })
}

export function applyResourceTransactions(input: {
  resourcePool: ResourcePoolState
  cycleId: string
  requests: ResourceTransactionRequest[]
  tags?: string[]
}): ResourceCycleResult {
  const nextResources = cloneResources(input.resourcePool.resources)
  const transactions = input.requests.map((request, index) => {
    const resource = nextResources[request.resourceKey]
    const transaction = buildResourceTransaction({
      transactionId:
        request.transactionId ??
        `${input.cycleId}:${request.resourceKey}:${index.toString(36)}`,
      resource,
      amount: request.amount,
      reason: request.reason,
      source: request.source,
      tags: [...(request.tags ?? []), ...(input.tags ?? [])],
    })

    nextResources[request.resourceKey] = {
      ...resource,
      current: transaction.after,
      warnings: [...resource.warnings, ...transaction.warnings],
    }

    return transaction
  })
  const resourcePool: ResourcePoolState = {
    ...input.resourcePool,
    resources: nextResources,
    transactions: [...input.resourcePool.transactions, ...transactions],
    tags: [
      ...input.resourcePool.tags,
      "resource_cycle_applied",
      ...(input.tags ?? []),
    ],
  }
  const audit = auditResourcePoolState(resourcePool)
  const warnings = [
    ...transactions.flatMap((transaction) => transaction.warnings),
    ...audit.warnings,
  ]

  return {
    cycleId: input.cycleId,
    resourcePool: {
      ...resourcePool,
      warnings,
    },
    transactions,
    audit,
    warnings,
    tags: [
      "resource_cycle_result",
      warnings.length === 0 ? "resource_cycle_clean" : "resource_cycle_warning",
      ...(input.tags ?? []),
    ],
  }
}

export function auditResourcePoolState(
  resourcePool: ResourcePoolState
): ResourceAudit {
  const warnings = RESOURCE_KEYS.flatMap((resourceKey) => {
    const resource = resourcePool.resources[resourceKey]

    if (!resource) {
      return [`Missing resource state: ${resourceKey}.`]
    }

    if (resource.current < resource.min) {
      return [`Resource ${resourceKey} is below min.`]
    }

    if (resource.current > resource.max) {
      return [`Resource ${resourceKey} is above max.`]
    }

    return []
  })
  const blockedTransactionIds = resourcePool.transactions
    .filter((transaction) => transaction.status === "blocked")
    .map((transaction) => transaction.transactionId)

  return {
    auditId: `resource-audit:${resourcePool.worldId}:${resourcePool.regionId}`,
    passed: warnings.length === 0,
    checkedResourceKeys: [...RESOURCE_KEYS],
    blockedTransactionIds,
    warnings,
    tags: [
      "resource_audit",
      warnings.length === 0 ? "resource_audit_passed" : "resource_audit_warning",
      resourcePool.biomeType,
    ],
  }
}

export function resourcePoolToHomeResourceSnapshot(
  resourcePool: ResourcePoolState
): {
  groundHealth: number
  naturalGrowth: number
  materialReadiness: number
  careReadiness: number
  spacePressure: number
} {
  return {
    groundHealth: resourcePool.resources.groundHealth.current,
    naturalGrowth: resourcePool.resources.naturalGrowth.current,
    materialReadiness: resourcePool.resources.materialReadiness.current,
    careReadiness: resourcePool.resources.careReadiness.current,
    spacePressure: resourcePool.resources.spacePressure.current,
  }
}

function buildResourceTransaction(input: {
  transactionId: string
  resource: ResourceValueState
  amount: number
  reason: string
  source: ResourceTransaction["source"]
  tags: string[]
}): ResourceTransaction {
  const before = input.resource.current
  const rawAfter = before + input.amount

  if (rawAfter < input.resource.min) {
    return {
      transactionId: input.transactionId,
      resourceKey: input.resource.resourceKey,
      amount: input.amount,
      reason: input.reason,
      source: input.source,
      before,
      after: before,
      status: "blocked",
      tags: [...input.tags, "resource_underflow_blocked"],
      warnings: [
        `Blocked ${input.resource.resourceKey} transaction because it would go below min.`,
      ],
    }
  }

  if (rawAfter > input.resource.max) {
    return {
      transactionId: input.transactionId,
      resourceKey: input.resource.resourceKey,
      amount: input.amount,
      reason: input.reason,
      source: input.source,
      before,
      after: input.resource.max,
      status: "clamped",
      tags: [...input.tags, "resource_overflow_clamped"],
      warnings: [
        `Clamped ${input.resource.resourceKey} transaction because it exceeded max.`,
      ],
    }
  }

  return {
    transactionId: input.transactionId,
    resourceKey: input.resource.resourceKey,
    amount: input.amount,
    reason: input.reason,
    source: input.source,
    before,
    after: rawAfter,
    status: "applied",
    tags: input.tags,
    warnings: [],
  }
}

function cloneResources(
  resources: ResourcePoolState["resources"]
): ResourcePoolState["resources"] {
  return RESOURCE_KEYS.reduce(
    (draft, resourceKey) => {
      draft[resourceKey] = {
        ...resources[resourceKey],
        tags: [...resources[resourceKey].tags],
        warnings: [...resources[resourceKey].warnings],
      }

      return draft
    },
    {} as ResourcePoolState["resources"]
  )
}

function clampResourceValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
