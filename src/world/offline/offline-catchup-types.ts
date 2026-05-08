/**
 * 当前文件负责：定义世界离线补算的数据结构。
 */

export type OfflineCatchupPlan = {
  shouldCatchup: boolean
  offlineMs: number
  offlineMinutes: number
  tickCount: number
  reason: string
}

export type OfflineCatchupResult = {
  plan: OfflineCatchupPlan
  appliedTickCount: number
  startedAtTick: number
  endedAtTick: number
  summary: string
}

export type BuildOfflineCatchupPlanInput = {
  lastSavedAt: number
  now: number
}

export type BuildOfflineCatchupResultInput = {
  plan: OfflineCatchupPlan
  startedAtTick: number
  endedAtTick: number
}