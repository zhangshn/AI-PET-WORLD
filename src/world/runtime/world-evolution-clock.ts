/**
 * Logical-time proposal arithmetic for ARCHITECTURE 4.4.2 / 4.4.4.
 * No I/O, timers, wall-clock sampling, world writes, or capability decisions.
 * The runtime must separately verify the recovered backlog and committed end
 * against its Store/transaction evidence. Shape validation here is not that proof.
 */
export type WorldEvolutionTimePolicy = Readonly<{
  simulationEpochUtc: string
  stepSeconds: number
  scheduleIntervalSeconds: number
  modelHorizonSeconds: number
  downtimeMode: "freeze" | "bounded_catchup"
  maxCatchupSteps: number
  maxCatchupLogicalSeconds: number
}>

export type WorldEvolutionClockAnchor = Readonly<{ kind: "world_evolution_clock_anchor" }>
export type WorldEvolutionInterval = Readonly<{
  logicalStartUtc: string
  logicalEndUtc: string
  durationSeconds: number
}>
export type WorldEvolutionBatch = Readonly<{
  proposalOnly: true
  committedStateVerified: false
  committedLogicalEndUtc: string
  intervals: readonly WorldEvolutionInterval[]
  dueSteps: number
  proposedSteps: number
  pendingStepsAfterProposals: number
  recoveredPendingSteps: number
  recoveryLimitReached: boolean
  nextScheduleInMilliseconds: number
}>

type AnchorData = {
  policy: WorldEvolutionTimePolicy
  originEndMs: number
  originMonotonicMs: number
  recoveredPendingSteps: number
  observedMonotonicMs: number
  observedCommittedEndMs: number
}
const anchors = new WeakMap<WorldEvolutionClockAnchor, AnchorData>()
const POLICY_FIELDS = ["simulationEpochUtc", "stepSeconds", "scheduleIntervalSeconds",
  "modelHorizonSeconds", "downtimeMode", "maxCatchupSteps", "maxCatchupLogicalSeconds"] as const
// A component allocation bound, not a world speed or resource-policy default.
export const WORLD_EVOLUTION_MAX_BATCH_INTERVALS = 1024

function requireClock(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Error("world_evolution_clock_invalid:" + why)
}
function objectWithKeys(value: unknown, fields: readonly string[]): Record<string, unknown> {
  requireClock(value !== null && typeof value === "object" && !Array.isArray(value), "object")
  const prototype = Object.getPrototypeOf(value)
  requireClock(prototype === Object.prototype || prototype === null, "prototype")
  const keys = Reflect.ownKeys(value)
  requireClock(keys.length === fields.length && keys.every(k => typeof k === "string" && fields.includes(k)), "fields")
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    requireClock(descriptor.enumerable && Object.hasOwn(descriptor, "value"), "accessor")
  }
  return value as Record<string, unknown>
}
function safeInteger(value: unknown, minimum: number, why: string): number {
  requireClock(typeof value === "number" && Number.isSafeInteger(value) && value >= minimum, why)
  return value
}
function secondsToMs(value: unknown, positive: boolean, why: string): number {
  requireClock(typeof value === "number" && Number.isFinite(value) && (positive ? value > 0 : value >= 0), why)
  return safeInteger(value * 1000, positive ? 1 : 0, why + "_milliseconds")
}
function monotonic(value: unknown): number {
  requireClock(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER, "monotonic")
  return value
}
function utcMilliseconds(value: unknown): number {
  requireClock(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value), "utc_format")
  const result = Date.parse(value)
  requireClock(Number.isSafeInteger(result) && new Date(result).toISOString() === value, "utc_roundtrip")
  return result
}
function isoFromMs(value: number): string {
  requireClock(Number.isSafeInteger(value), "logical_time_overflow")
  const date = new Date(value)
  requireClock(Number.isFinite(date.getTime()), "logical_time_overflow")
  const iso = date.toISOString()
  utcMilliseconds(iso)
  return iso
}
function safeSum(a: number, b: number): number {
  return safeInteger(a + b, 0, "step_count_overflow")
}

/** Validates syntax and time-scale compatibility only; never grants qualification. */
export function validateWorldEvolutionTimePolicy(value: unknown): WorldEvolutionTimePolicy {
  const v = objectWithKeys(value, POLICY_FIELDS)
  utcMilliseconds(v.simulationEpochUtc)
  const stepMs = secondsToMs(v.stepSeconds, true, "step")
  secondsToMs(v.scheduleIntervalSeconds, true, "schedule")
  requireClock(stepMs === secondsToMs(v.modelHorizonSeconds, true, "horizon"), "horizon_mismatch")
  const catchupSteps = safeInteger(v.maxCatchupSteps, 0, "catchup_steps")
  const catchupMs = secondsToMs(v.maxCatchupLogicalSeconds, false, "catchup_span")
  requireClock(v.downtimeMode === "freeze" || v.downtimeMode === "bounded_catchup", "downtime_mode")
  if (v.downtimeMode === "freeze") requireClock(catchupSteps === 0 && catchupMs === 0, "freeze_budget")
  else requireClock(catchupSteps > 0 && catchupMs > 0, "catchup_budget")
  return Object.freeze({ ...v }) as WorldEvolutionTimePolicy
}

/**
 * Establishes an in-process monotonic origin after a trusted recovery read.
 * This does not initialize a persisted world clock. An unknown end must fail.
 * recoveredPendingSteps must come from recovery evidence, never UTC subtraction.
 */
export function createWorldEvolutionClockAnchor(value: unknown): WorldEvolutionClockAnchor {
  const v = objectWithKeys(value, ["policy", "lastCommittedLogicalEndUtc", "monotonicNowMs", "recoveredPendingSteps"])
  const policy = validateWorldEvolutionTimePolicy(v.policy)
  const originEndMs = utcMilliseconds(v.lastCommittedLogicalEndUtc)
  const epochMs = utcMilliseconds(policy.simulationEpochUtc)
  const stepMs = secondsToMs(policy.stepSeconds, true, "step")
  requireClock(originEndMs >= epochMs && (originEndMs - epochMs) % stepMs === 0, "committed_end_grid")
  const originMonotonicMs = monotonic(v.monotonicNowMs)
  const recoveredPendingSteps = safeInteger(v.recoveredPendingSteps, 0, "recovered_pending")
  requireClock(policy.downtimeMode !== "freeze" || recoveredPendingSteps === 0, "freeze_recovered_pending")
  const anchor = Object.freeze({ kind: "world_evolution_clock_anchor" as const })
  anchors.set(anchor, { policy, originEndMs, originMonotonicMs, recoveredPendingSteps,
    observedMonotonicMs: originMonotonicMs, observedCommittedEndMs: originEndMs })
  return anchor
}

/**
 * Bounded proposals, starting at the latest independently verified committed end.
 * Repeating a proposal consumes nothing. Observed commit progress and monotonic
 * readings cannot move backwards within this anchor; Store CAS and commit receipts
 * are still required for transaction-level proof and cross-process deduplication.
 */
export function planWorldEvolutionBatch(anchor: WorldEvolutionClockAnchor, value: unknown): WorldEvolutionBatch {
  const data = anchors.get(anchor)
  requireClock(data, "owned_anchor_required")
  const v = objectWithKeys(value, ["monotonicNowMs", "committedLogicalEndUtc", "remainingStepBudget", "remainingLogicalSeconds", "maxBatchSteps"])
  const now = monotonic(v.monotonicNowMs)
  requireClock(now >= data.observedMonotonicMs, "monotonic_backwards")
  const endMs = utcMilliseconds(v.committedLogicalEndUtc)
  requireClock(endMs >= data.observedCommittedEndMs, "committed_end_backwards")
  const stepMs = secondsToMs(data.policy.stepSeconds, true, "step")
  const scheduleMs = secondsToMs(data.policy.scheduleIntervalSeconds, true, "schedule")
  const deltaMs = endMs - data.originEndMs
  requireClock(Number.isSafeInteger(deltaMs) && deltaMs >= 0 && deltaMs % stepMs === 0, "committed_end_grid")
  const committedSteps = deltaMs / stepMs
  const elapsedMs = now - data.originMonotonicMs
  requireClock(Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= Number.MAX_SAFE_INTEGER, "elapsed_overflow")
  const scheduledSteps = safeInteger(Math.floor(elapsedMs / scheduleMs), 0, "scheduled_steps")
  const availableSteps = safeSum(data.recoveredPendingSteps, scheduledSteps)
  requireClock(committedSteps <= availableSteps, "unearned_commit_progress")
  const stepBudget = safeInteger(v.remainingStepBudget, 0, "execution_step_budget")
  const logicalBudgetMs = secondsToMs(v.remainingLogicalSeconds, false, "execution_logical_budget")
  const batchLimit = safeInteger(v.maxBatchSteps, 1, "batch_limit")
  requireClock(batchLimit <= WORLD_EVOLUTION_MAX_BATCH_INTERVALS, "batch_allocation_bound")
  const dueSteps = availableSteps - committedSteps
  const recoveredPendingSteps = Math.max(0, data.recoveredPendingSteps - committedSteps)
  let permittedSteps = dueSteps
  let recoveryLimitReached = false
  if (recoveredPendingSteps > 0) {
    const catchupLimit = Math.min(data.policy.maxCatchupSteps,
      Math.floor(secondsToMs(data.policy.maxCatchupLogicalSeconds, false, "catchup_span") / stepMs))
    const remainingCatchupSteps = Math.max(0, catchupLimit - committedSteps)
    // Never skip an unprocessed recovered interval to reach newer scheduled work.
    if (remainingCatchupSteps < recoveredPendingSteps) permittedSteps = remainingCatchupSteps
    recoveryLimitReached = remainingCatchupSteps <= 0
  }
  const proposedSteps = Math.min(permittedSteps, stepBudget, Math.floor(logicalBudgetMs / stepMs), batchLimit)
  requireClock(Number.isSafeInteger(proposedSteps * stepMs), "proposal_span_overflow")
  // Preflight the entire range before allocating or changing observation cursors.
  isoFromMs(endMs + proposedSteps * stepMs)
  const intervals: WorldEvolutionInterval[] = []
  for (let index = 0; index < proposedSteps; index++) {
    const start = endMs + index * stepMs
    intervals.push(Object.freeze({ logicalStartUtc: isoFromMs(start), logicalEndUtc: isoFromMs(start + stepMs), durationSeconds: data.policy.stepSeconds }))
  }
  data.observedMonotonicMs = now
  data.observedCommittedEndMs = endMs
  return Object.freeze({ proposalOnly: true, committedStateVerified: false,
    committedLogicalEndUtc: v.committedLogicalEndUtc as string, intervals: Object.freeze(intervals),
    dueSteps, proposedSteps, pendingStepsAfterProposals: dueSteps - proposedSteps,
    recoveredPendingSteps, recoveryLimitReached,
    nextScheduleInMilliseconds: scheduleMs - (elapsedMs % scheduleMs) })
}
