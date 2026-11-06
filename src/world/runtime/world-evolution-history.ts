import { createHash } from "node:crypto"

/** Internal query values only: this module does not read a Store, attest a
 * transaction, publish a capability, or define the persistent event protocol. */
export type EvolutionHistoryIdentity = {
  ownerId: string; playerId: string; worldId: string
  worldSeed: string; worldProfileId: string; regionId: string
}
export type EvolutionHistoryAnchor = {
  cursor: number; tick: number; stateVersion: number
  logicalEndUtc: string; eventSha256: string | null
}
export type EvolutionHistoryProjection = {
  projectionVersion: "world-evolution-history-projection-v1"
  origin: "world_lived_event"
  identity: EvolutionHistoryIdentity
  eventId: string; businessKey: string
  cursor: number; eventKind: "evolution" | "maintenance"
  fromTick: number; toTick: number
  fromStateVersion: number; toStateVersion: number
  interval: { logicalStartUtc: string; logicalEndUtc: string; durationSeconds: number }
  previousEventSha256: string | null
  domainAfterSha256: string
  reasonRefs: string[]
}
export type EvolutionHistoryEntry = {
  originalEvent: Record<string, unknown>
  content: EvolutionHistoryProjection
  projectionSha256: string
}
export type EvolutionHistoryQuery = {
  identity: EvolutionHistoryIdentity
  startAnchor: EvolutionHistoryAnchor
  committedHead: EvolutionHistoryAnchor
  limits: { maxEvents: number; maxBytes: number; minimumContextEvents: number }
  events: EvolutionHistoryEntry[]
}
export type EvolutionHistorySelection = {
  validationOnly: true; productionReady: false; commitAuthenticityVerified: false
  meaning: "original_event_integrity_and_core_chain_not_commit_or_domain_proof"
  status: "chain_matches_supplied_anchors" | "cold_start_qualification_missing" | "minimum_history_missing"
  identity: EvolutionHistoryIdentity
  startAnchor: EvolutionHistoryAnchor; committedHead: EvolutionHistoryAnchor
  events: EvolutionHistoryEntry[]
  selectedCount: number; inputBytes: number; contentSha256: string
  externalArchiveIncluded: false
}

const IDENTITIES = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"] as const
const SHA = /^[a-f0-9]{64}$/u
const MAX_BYTES = 4 * 1024 * 1024
const MAX_EVENTS = 4096
function need(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(`world_history_invalid:${why}`) }
function object(value: unknown): asserts value is Record<string, unknown> {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "object")
  const proto = Object.getPrototypeOf(value)
  need(proto === Object.prototype || proto === null, "prototype")
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key)!
    need(typeof key === "string" && d.enumerable && Object.hasOwn(d, "value"), "accessor_or_symbol")
  }
}
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  object(value); need(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), "fields")
}
function count(value: unknown): asserts value is number { need(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "counter") }
function text(value: unknown): asserts value is string { need(typeof value === "string" && value.trim().length > 0, "text") }
function hash(value: unknown): asserts value is string { need(typeof value === "string" && SHA.test(value), "hash") }
function utc(value: unknown): number {
  need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value), "utc")
  const ms = Date.parse(value)
  need(Number.isSafeInteger(ms) && new Date(ms).toISOString() === value, "utc")
  return ms
}
function identity(value: unknown): asserts value is EvolutionHistoryIdentity {
  exact(value, IDENTITIES); for (const key of IDENTITIES) text(value[key])
}
function anchor(value: unknown): asserts value is EvolutionHistoryAnchor {
  exact(value, ["cursor", "tick", "stateVersion", "logicalEndUtc", "eventSha256"])
  count(value.cursor); count(value.tick); count(value.stateVersion); utc(value.logicalEndUtc)
  need(value.tick <= value.stateVersion && value.stateVersion === value.cursor, "anchor_counters")
  if (value.cursor === 0) need(value.eventSha256 === null && value.tick === 0, "genesis_anchor")
  else hash(value.eventSha256)
}

/** Count canonical UTF-8 bytes while rejecting non-JSON values before any clone.
 * Individual strings are bounded before escaping; object/array nodes are bounded
 * by the same budget. Accessors are never invoked. */
function boundedCanonical(value: unknown, maxBytes: number): string {
  let bytes = 0
  const ancestors = new Set<object>()
  const add = (s: string) => { bytes += Buffer.byteLength(s, "utf8"); need(bytes <= maxBytes, "byte_budget"); return s }
  const walk = (v: unknown, depth: number): string => {
    need(depth <= 64, "depth")
    if (v === null || typeof v === "boolean") return add(JSON.stringify(v))
    if (typeof v === "number") { need(Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)), "number"); return add(JSON.stringify(v)) }
    if (typeof v === "string") { need(Buffer.byteLength(v, "utf8") <= maxBytes - bytes, "byte_budget"); return add(JSON.stringify(v)) }
    need(typeof v === "object" && v !== null && !ancestors.has(v), "cycle_or_non_json")
    ancestors.add(v)
    let result: string
    if (Array.isArray(v)) {
      need(Object.getPrototypeOf(v) === Array.prototype, "prototype")
      need(v.length <= maxBytes, "byte_budget")
      const keys = Reflect.ownKeys(v)
      need(keys.length === v.length + 1, "sparse_or_extra_array")
      result = add("[")
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i))
        need(d && d.enumerable && Object.hasOwn(d, "value"), "array_accessor_or_hole")
        if (i) result += add(",")
        result += walk(d.value, depth + 1)
      }
      result += add("]")
    } else {
      object(v); result = add("{")
      const keys = Object.keys(v).sort()
      for (let i = 0; i < keys.length; i++) {
        if (i) result += add(",")
        result += walk(keys[i], depth + 1) + add(":") + walk(Object.getOwnPropertyDescriptor(v, keys[i])!.value, depth + 1)
      }
      result += add("}")
    }
    ancestors.delete(v); return result
  }
  return walk(value, 0)
}
function digest(canonical: string): string { return createHash("sha256").update(canonical, "utf8").digest("hex") }
function freeze<T>(v: T): T {
  if (v !== null && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v) }
  return v
}

/** Validate a complete, contiguous supplied suffix ending at committedHead.
 * Neither anchor is authenticated here. A Store reader must independently bind
 * these original event bytes to the committed state. Original events' extra
 * evidence fields are integrity-bound, not semantically qualified here.
 * Omitting older events never deletes those originals; an empty tail at a
 * nonempty head is rejected instead of masquerading as a cold start. */
export function validateWorldEvolutionHistory(input: unknown): EvolutionHistorySelection {
  exact(input, ["identity", "startAnchor", "committedHead", "limits", "events"])
  exact(input.limits, ["maxEvents", "maxBytes", "minimumContextEvents"])
  const limits = input.limits
  count(limits.maxEvents); count(limits.maxBytes); count(limits.minimumContextEvents)
  need(limits.maxEvents > 0 && limits.maxEvents <= MAX_EVENTS && limits.maxBytes > 0 && limits.maxBytes <= MAX_BYTES && limits.minimumContextEvents <= limits.maxEvents, "limits")
  need(Array.isArray(input.events) && input.events.length <= limits.maxEvents, "event_budget")
  const canonical = boundedCanonical(input, limits.maxBytes)
  identity(input.identity); anchor(input.startAnchor); anchor(input.committedHead)
  const start = input.startAnchor, head = input.committedHead
  need(start.cursor <= head.cursor && start.tick <= head.tick && utc(start.logicalEndUtc) <= utc(head.logicalEndUtc), "anchor_order")
  need(head.cursor - start.cursor === input.events.length, "suffix_coverage")
  need(input.events.length > 0 || head.cursor === 0, "empty_suffix_not_genesis")
  let previous: EvolutionHistoryAnchor = start
  const ids = new Set<string>(), keys = new Set<string>()
  for (const entry of input.events) {
    exact(entry, ["originalEvent", "content", "projectionSha256"]); hash(entry.projectionSha256)
    const e = entry.content
    exact(e, ["projectionVersion", "origin", "identity", "eventId", "businessKey", "cursor", "eventKind", "fromTick", "toTick", "fromStateVersion", "toStateVersion", "interval", "previousEventSha256", "domainAfterSha256", "reasonRefs"])
    need(e.projectionVersion === "world-evolution-history-projection-v1" && e.origin === "world_lived_event", "projection_origin")
    // Unlike the strictly closed projection, an original event may retain
    // additional domain evidence. All its contents participate in its own hash.
    // Only the listed core is interpreted; this is not a full event validator.
    object(entry.originalEvent)
    const original = entry.originalEvent
    need(original.schemaVersion === "world-evolution-event-v1", "original_schema")
    hash(original.eventSha256)
    const originalWithoutHash = Object.fromEntries(Object.entries(original).filter(([key]) => key !== "eventSha256"))
    need(digest(boundedCanonical(originalWithoutHash, limits.maxBytes)) === original.eventSha256, "original_event_hash")
    for (const key of ["identity", "eventId", "businessKey", "cursor", "eventKind", "fromTick", "toTick", "fromStateVersion", "toStateVersion", "interval", "previousEventSha256", "domainAfterSha256", "reasonRefs"]) {
      need(Object.hasOwn(original, key) && boundedCanonical(original[key], limits.maxBytes) === boundedCanonical(e[key], limits.maxBytes), "original_projection_mismatch")
    }
    identity(e.identity)
    const eventIdentity = e.identity, worldIdentity = input.identity
    need(IDENTITIES.every(k => eventIdentity[k] === worldIdentity[k]), "cross_world")
    text(e.eventId); hash(e.businessKey); hash(e.domainAfterSha256)
    need(!ids.has(e.eventId) && !keys.has(e.businessKey), "duplicate_event"); ids.add(e.eventId); keys.add(e.businessKey)
    for (const key of ["cursor", "fromTick", "toTick", "fromStateVersion", "toStateVersion"]) count(e[key])
    need(e.cursor === previous.cursor + 1 && e.fromTick === previous.tick && e.fromStateVersion === previous.stateVersion && e.toStateVersion === previous.stateVersion + 1, "counter_chain")
    need(e.previousEventSha256 === previous.eventSha256, "hash_chain")
    exact(e.interval, ["logicalStartUtc", "logicalEndUtc", "durationSeconds"])
    const begin = utc(e.interval.logicalStartUtc), end = utc(e.interval.logicalEndUtc), seconds = e.interval.durationSeconds
    need(typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 && Number.isSafeInteger(seconds * 1000) && seconds * 1000 === end - begin, "duration")
    need(e.interval.logicalStartUtc === previous.logicalEndUtc && end <= utc(head.logicalEndUtc), "interval_chain")
    if (e.eventKind === "evolution") need(seconds > 0 && e.toTick === previous.tick + 1, "evolution_transition")
    else need(e.eventKind === "maintenance" && seconds === 0 && e.toTick === previous.tick, "maintenance_transition")
    need(Array.isArray(e.reasonRefs) && e.reasonRefs.length > 0 && e.reasonRefs.length <= 64, "reasons")
    e.reasonRefs.forEach(hash)
    need(digest(boundedCanonical(e, limits.maxBytes)) === entry.projectionSha256, "projection_hash")
    previous = { cursor: e.cursor as number, tick: e.toTick as number, stateVersion: e.toStateVersion as number, logicalEndUtc: e.interval.logicalEndUtc as string, eventSha256: original.eventSha256 }
  }
  need(previous.cursor === head.cursor && previous.tick === head.tick && previous.stateVersion === head.stateVersion && previous.logicalEndUtc === head.logicalEndUtc && previous.eventSha256 === head.eventSha256, "committed_head_mismatch")
  // Clone only after the full count, byte, shape and chain checks.
  const copied = JSON.parse(canonical) as EvolutionHistoryQuery
  const status = copied.events.length === 0 ? "cold_start_qualification_missing" : copied.events.length < limits.minimumContextEvents ? "minimum_history_missing" : "chain_matches_supplied_anchors"
  const result: EvolutionHistorySelection = { validationOnly: true, productionReady: false, commitAuthenticityVerified: false,
    meaning: "original_event_integrity_and_core_chain_not_commit_or_domain_proof", status,
    identity: copied.identity, startAnchor: copied.startAnchor, committedHead: copied.committedHead,
    events: copied.events, selectedCount: copied.events.length, inputBytes: Buffer.byteLength(canonical, "utf8"),
    contentSha256: digest(canonical), externalArchiveIncluded: false }
  boundedCanonical(result, limits.maxBytes)
  return freeze(result)
}
