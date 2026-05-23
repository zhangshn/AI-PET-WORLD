/**
 * 当前文件职责：定义可审计资源池、资源交易与资源循环结果协议。
 */

export type ResourceKey =
  | "groundHealth"
  | "naturalGrowth"
  | "materialReadiness"
  | "careReadiness"
  | "spacePressure"

export type ResourceTransactionSource =
  | "initialization"
  | "natural_regeneration"
  | "construction_cost"
  | "maintenance_cost"
  | "biome_pressure"
  | "conversion"
  | "event"
  | "audit"

export type ResourceTransactionStatus = "applied" | "blocked" | "clamped"

export type ResourceValueState = {
  resourceKey: ResourceKey
  current: number
  min: number
  max: number
  regenPerTick: number
  pressure: number
  tags: string[]
  warnings: string[]
}

export type ResourceTransaction = {
  transactionId: string
  resourceKey: ResourceKey
  amount: number
  reason: string
  source: ResourceTransactionSource
  before: number
  after: number
  status: ResourceTransactionStatus
  tags: string[]
  warnings: string[]
}

export type ResourceTransactionRequest = {
  transactionId?: string
  resourceKey: ResourceKey
  amount: number
  reason: string
  source: ResourceTransactionSource
  tags?: string[]
}

export type ResourcePoolState = {
  version: "v2_resource_pool_0"
  worldId: string
  regionId: string
  biomeType: "grassland" | "forest" | "desert" | "oasis"
  resources: Record<ResourceKey, ResourceValueState>
  transactions: ResourceTransaction[]
  tags: string[]
  warnings: string[]
}

export type ResourceAudit = {
  auditId: string
  passed: boolean
  checkedResourceKeys: ResourceKey[]
  blockedTransactionIds: string[]
  warnings: string[]
  tags: string[]
}

export type ResourceCycleInput = {
  resourcePool: ResourcePoolState
  cycleId: string
  reason: string
  source?: ResourceTransactionSource
  requests?: ResourceTransactionRequest[]
  includeNaturalRegeneration?: boolean
  tags?: string[]
}

export type ResourceCycleResult = {
  cycleId: string
  resourcePool: ResourcePoolState
  transactions: ResourceTransaction[]
  audit: ResourceAudit
  warnings: string[]
  tags: string[]
}
