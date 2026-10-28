/** Shared validation of the existing local WorldRuntimeSaveRecord shape. */
import { createHash } from "node:crypto"
import type { HomeMapState } from "@/world/map-state/home-map-state-schema"
import type { WorldRuntimeEventLog, WorldRuntimeSaveRecord } from "./world-runtime-schema"
import type {
  NaturalWorldRuntimeRecordInput, NaturalWorldRuntimeSaveRecord,
  NaturalWorldRuntimeReadInput, NaturalWorldRuntimeWriteInput,
} from "./world-runtime-schema"

export function isWorldRuntimeSaveRecord(value: unknown): value is WorldRuntimeSaveRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<WorldRuntimeSaveRecord>
  const tick = record.tick
  if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0) return false
  const homeMapState = record.homeMapState
  if (!isHomeMapStateShape(homeMapState)) return false
  const recentEvents = record.recentEvents
  if (!isWorldRuntimeEventLogArray(recentEvents)) return false
  return (
    record.version === "v2.6-runtime-00" &&
    isNonEmptyIdentity(record.worldId) &&
    isNonEmptyIdentity(record.ownerId) &&
    isIsoTimestamp(record.savedAt) &&
    Boolean(record.butlerProfile) &&
    Boolean(record.butlerRuntimeProfile) &&
    Boolean(record.butlerBirthInput) &&
    typeof record.butlerMappingMode === "string" &&
    Boolean(record.butlerConstructionStyle) &&
    typeof record.worldCreationStyleSource === "string" &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string") &&
    homeMapState.worldId === record.worldId &&
    homeMapState.ownerId === record.ownerId &&
    recentEvents.every((event) => event.tick >= 0 && event.tick <= tick)
  )
}

function isNonEmptyIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function isHomeMapStateShape(value: unknown): value is HomeMapState {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<HomeMapState>
  return (
    typeof record.worldId === "string" &&
    typeof record.ownerId === "string" &&
    typeof record.seed === "string" &&
    isHomeMapSizeShape(record.mapSize) &&
    Array.isArray(record.zones) &&
    Array.isArray(record.placements) &&
    isHomeResourceStateShape(record.resources) &&
    Array.isArray(record.constructionPlans) &&
    Array.isArray(record.mapDiffs) &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.createdAt) &&
    Number.isFinite(record.updatedAt) &&
    record.updatedAt >= record.createdAt &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string")
  )
}

function isHomeMapSizeShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<HomeMapState["mapSize"]>
  return (
    typeof record.columns === "number" &&
    typeof record.rows === "number" &&
    typeof record.tileSize === "number"
  )
}

function isHomeResourceStateShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<HomeMapState["resources"]>
  return (
    typeof record.groundHealth === "number" &&
    typeof record.naturalGrowth === "number" &&
    typeof record.materialReadiness === "number" &&
    typeof record.careReadiness === "number" &&
    typeof record.spacePressure === "number" &&
    Array.isArray(record.tags)
  )
}

function isWorldRuntimeEventLogArray(value: unknown): value is WorldRuntimeEventLog[] {
  return Array.isArray(value) && value.every(isWorldRuntimeEventLogShape)
}

function isWorldRuntimeEventLogShape(value: unknown): value is WorldRuntimeEventLog {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<WorldRuntimeEventLog>
  return (
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.tick === "number" && Number.isInteger(record.tick) && record.tick >= 0 &&
    typeof record.title === "string" &&
    typeof record.body === "string" &&
    (record.source === "runtime" || record.source === "butler" || record.source === "construction" || record.source === "safe_apply" || record.source === "audit") &&
    isIsoTimestamp(record.createdAt) &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string")
  )
}


export const NATURAL_WORLD_MAX_BYTES = 4 * 1024 * 1024
const NATURAL_IDENTITY_KEYS = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"] as const
const NATURAL_HASH_KEYS = ["worldFactsPayloadSha256", "statePayloadSha256", "recordContentSha256"] as const
const NATURAL_KEYS = [...NATURAL_IDENTITY_KEYS, "version", "tick", "stateVersion", "savedAt", "worldFacts", "worldState", "ruleVersion", "eventCursor", "randomState", "sourceBindings"]
const SHA256 = /^[a-f0-9]{64}$/u

function naturalRequire(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(`natural_world_invalid:${detail}`)
}
function naturalObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function naturalText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 }
function naturalInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 }
function naturalKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  naturalRequire(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), "fields")
}
/** Validate before cloning/stringifying: accessors, custom prototypes and cycles are not JSON. */
function naturalJson(value: unknown, depth = 0, ancestors = new Set<object>()): void {
  naturalRequire(depth <= 64, "depth")
  if (value === null || typeof value === "string" || typeof value === "boolean") return
  if (typeof value === "number") {
    naturalRequire(Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), "number")
    return
  }
  naturalRequire(typeof value === "object", "json_type")
  const object = value as object
  naturalRequire(!ancestors.has(object), "cycle")
  const array = Array.isArray(value)
  naturalRequire(array ? Object.getPrototypeOf(value) === Array.prototype
    : Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, "prototype")
  ancestors.add(object)
  for (const key of Reflect.ownKeys(object)) {
    naturalRequire(typeof key === "string", "symbol_key")
    if (array && key === "length") continue
    const descriptor = Object.getOwnPropertyDescriptor(object, key)!
    naturalRequire(descriptor.enumerable && Object.hasOwn(descriptor, "value"), "accessor")
    if (array) naturalRequire(/^(0|[1-9][0-9]*)$/u.test(key) && Number(key) < value.length, "array_key")
    naturalJson(descriptor.value, depth + 1, ancestors)
  }
  if (array) naturalRequire(Object.keys(value).length === value.length, "sparse_array")
  ancestors.delete(object)
}
function naturalCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(naturalCanonical).join(",")}]`
  if (naturalObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${naturalCanonical(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}
function naturalDigest(value: unknown): string {
  return createHash("sha256").update(naturalCanonical(value), "utf8").digest("hex")
}
function naturalShape(value: unknown, stored: boolean): asserts value is NaturalWorldRuntimeSaveRecord {
  naturalJson(value)
  naturalRequire(naturalObject(value), "record")
  const keys = Object.keys(value).filter(key => !(NATURAL_HASH_KEYS as readonly string[]).includes(key))
  naturalRequire(keys.length === NATURAL_KEYS.length && NATURAL_KEYS.every(key => Object.hasOwn(value, key)), "record_fields")
  naturalRequire(value.version === "natural-world-runtime-save-v1", "version")
  for (const key of NATURAL_IDENTITY_KEYS) naturalRequire(naturalText(value[key]), key)
  // Windows alternate data streams must never become natural world path identities.
  naturalRequire(!(value.ownerId as string).includes(":") && !(value.worldId as string).includes(":"), "path_identity_ads")
  naturalRequire(naturalInteger(value.tick) && naturalInteger(value.stateVersion) && naturalInteger(value.eventCursor), "counters")
  naturalRequire(isIsoTimestamp(value.savedAt) && naturalText(value.ruleVersion), "time_or_rule")
  for (const key of ["worldFacts", "worldState"] as const) {
    const snapshot = value[key]
    naturalRequire(naturalObject(snapshot), key)
    naturalKeys(snapshot, ["schemaVersion", "worldId", "regionId", "tick", "payload"])
    naturalRequire(snapshot.worldId === value.worldId && snapshot.regionId === value.regionId && snapshot.tick === value.tick, "snapshot_identity")
    naturalRequire(naturalObject(snapshot.payload), "snapshot_payload")
    if (key === "worldFacts") {
      naturalRequire(snapshot.schemaVersion === "natural-world-facts-snapshot-v1", "facts_version")
      naturalKeys(snapshot.payload, ["terrainRegions", "objectFootprints", "walkableRegions", "collisionRegions"])
      for (const role of ["terrainRegions", "objectFootprints", "walkableRegions", "collisionRegions"]) {
        const rows = snapshot.payload[role]
        naturalRequire(Array.isArray(rows) && rows.every(naturalObject), "facts_object_array")
        if (role === "terrainRegions" || role === "walkableRegions") naturalRequire(rows.length > 0, "facts_required_array")
      }
    } else {
      naturalRequire(snapshot.schemaVersion === "natural-world-state-snapshot-v1", "state_version")
      naturalKeys(snapshot.payload, ["environment", "objects", "resources"])
      naturalRequire(naturalObject(snapshot.payload.environment) && Object.keys(snapshot.payload.environment).length > 0, "environment")
      for (const role of ["objects", "resources"]) naturalRequire(Array.isArray(snapshot.payload[role]) && snapshot.payload[role].every(naturalObject), "state_object_array")
    }
  }
  naturalRequire(naturalObject(value.randomState), "random_state")
  if (value.randomState.status === "captured") {
    naturalKeys(value.randomState, ["status", "algorithmId", "algorithmVersion", "state"])
    naturalRequire(naturalText(value.randomState.algorithmId) && naturalText(value.randomState.algorithmVersion) && naturalObject(value.randomState.state), "captured_random_state")
  } else {
    naturalKeys(value.randomState, ["status", "reason"])
    naturalRequire(value.randomState.status === "not_consumed" && naturalText(value.randomState.reason), "random_applicability")
  }
  naturalRequire(Array.isArray(value.sourceBindings) && value.sourceBindings.length > 0, "source_bindings")
  for (const source of value.sourceBindings) {
    naturalRequire(naturalObject(source), "source")
    naturalKeys(source, ["role", "uri", "fileSha256"])
    naturalRequire(naturalText(source.role) && naturalText(source.uri) && typeof source.fileSha256 === "string" && SHA256.test(source.fileSha256), "source_binding")
  }
  if (stored) for (const key of NATURAL_HASH_KEYS) naturalRequire(typeof value[key] === "string" && SHA256.test(value[key]), "stored_hash")
}
function naturalStateDigest(record: NaturalWorldRuntimeRecordInput): string {
  return naturalDigest({ ...Object.fromEntries(NATURAL_IDENTITY_KEYS.map(key => [key, record[key]])),
    worldState: record.worldState, randomState: record.randomState, ruleVersion: record.ruleVersion,
    eventCursor: record.eventCursor, tick: record.tick, stateVersion: record.stateVersion })
}
export function sealNaturalWorldRuntimeRecord(value: unknown): NaturalWorldRuntimeSaveRecord {
  naturalShape(value, false)
  naturalRequire(Buffer.byteLength(JSON.stringify(value), "utf8") <= NATURAL_WORLD_MAX_BYTES, "size")
  const copy = structuredClone(value)
  const base = Object.fromEntries(Object.entries(copy).filter(([key]) => !(NATURAL_HASH_KEYS as readonly string[]).includes(key))) as NaturalWorldRuntimeRecordInput
  const partial = { ...base, worldFactsPayloadSha256: naturalDigest(base.worldFacts), statePayloadSha256: naturalStateDigest(base) }
  const record = { ...partial, recordContentSha256: naturalDigest(partial) }
  naturalRequire(Buffer.byteLength(`${JSON.stringify(record, null, 2)}\n`, "utf8") <= NATURAL_WORLD_MAX_BYTES, "size")
  return record
}
export function decodeNaturalWorldRuntimeRecord(raw: Buffer): { record: NaturalWorldRuntimeSaveRecord; fileSha256: string } {
  naturalRequire(raw.length <= NATURAL_WORLD_MAX_BYTES, "size")
  let value: unknown
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw)) } catch { throw new Error("natural_world_invalid:json_or_utf8") }
  naturalShape(value, true)
  const sealed = sealNaturalWorldRuntimeRecord(value)
  for (const key of NATURAL_HASH_KEYS) naturalRequire(value[key] === sealed[key], key)
  return { record: value, fileSha256: createHash("sha256").update(raw).digest("hex") }
}
export function assertNaturalWorldReadInput(input: NaturalWorldRuntimeReadInput): void {
  naturalJson(input)
  naturalRequire(naturalObject(input) && naturalText(input.ownerId) && naturalText(input.worldId), "read_identity")
  naturalRequire(!input.ownerId.includes(":") && !input.worldId.includes(":"), "path_identity_ads")
  naturalRequire(Object.keys(input).every(key => ["ownerId", "worldId", "expectedTick", "expectedStateVersion", "expectedFileSha256", "expectedPlayerId"].includes(key)), "read_fields")
  for (const key of ["expectedTick", "expectedStateVersion"] as const) if (input[key] !== undefined) naturalRequire(naturalInteger(input[key]), "read_counter")
  if (input.expectedFileSha256 !== undefined) naturalRequire(SHA256.test(input.expectedFileSha256), "read_hash")
  if (input.expectedPlayerId !== undefined) naturalRequire(naturalText(input.expectedPlayerId), "read_player")
}
export function assertNaturalWorldReadMatch(record: NaturalWorldRuntimeSaveRecord, input: NaturalWorldRuntimeReadInput, fileSha256: string): void {
  naturalRequire(record.ownerId === input.ownerId && record.worldId === input.worldId, "requested_identity")
  if (input.expectedTick !== undefined) naturalRequire(input.expectedTick === record.tick, "requested_tick")
  if (input.expectedStateVersion !== undefined) naturalRequire(input.expectedStateVersion === record.stateVersion, "requested_state_version")
  if (input.expectedFileSha256 !== undefined) naturalRequire(input.expectedFileSha256 === fileSha256, "requested_file_hash")
  if (input.expectedPlayerId !== undefined) naturalRequire(input.expectedPlayerId === record.playerId, "requested_player")
}
export function snapshotNaturalWorldWrite(input: NaturalWorldRuntimeWriteInput): NaturalWorldRuntimeWriteInput & { record: NaturalWorldRuntimeSaveRecord } {
  naturalRequire(naturalObject(input) && (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null), "write")
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)!
    naturalRequire(typeof key === "string" && descriptor.enumerable && Object.hasOwn(descriptor, "value"), "write_fields")
  }
  naturalKeys(input, ["record", "expectedTick", "expectedStateVersion", "expectedFileSha256"])
  naturalRequire(Number.isSafeInteger(input.expectedTick) && input.expectedTick >= -1 && Number.isSafeInteger(input.expectedStateVersion) && input.expectedStateVersion >= -1, "write_cas_counters")
  naturalRequire(input.expectedFileSha256 === null || typeof input.expectedFileSha256 === "string" && SHA256.test(input.expectedFileSha256), "write_cas_hash")
  return { record: sealNaturalWorldRuntimeRecord(input.record), expectedTick: input.expectedTick,
    expectedStateVersion: input.expectedStateVersion, expectedFileSha256: input.expectedFileSha256 }
}
export function naturalWorldCasConflict(current: NaturalWorldRuntimeSaveRecord | null, next: NaturalWorldRuntimeSaveRecord,
  input: NaturalWorldRuntimeWriteInput, fileSha256: string | null): string | null {
  if (current === null) return input.expectedTick === -1 && input.expectedStateVersion === -1 && input.expectedFileSha256 === null && next.tick === 0 && next.stateVersion === 0 ? null : "natural_world_initial_cas_rejected"
  if (current.tick !== input.expectedTick || current.stateVersion !== input.expectedStateVersion || fileSha256 !== input.expectedFileSha256) return "natural_world_cas_rejected"
  if (next.stateVersion !== current.stateVersion + 1 || next.tick < current.tick || NATURAL_IDENTITY_KEYS.some(key => next[key] !== current[key])) return "natural_world_transition_rejected"
  return null
}

/** A present natural journal is evidence, never an empty-slot sentinel. */
export function validateNaturalWorldTransactionJournal(value: unknown, recordPath: string, worldId: string): {
  tick: number; stateVersion: number; recordContentSha256: string
} {
  naturalJson(value)
  naturalRequire(naturalObject(value), "transaction_object")
  naturalRequire(value.schemaVersion === "world-runtime-transaction-v1" && value.recordKind === "natural_world", "transaction_schema")
  naturalRequire(value.state === "prepared" || value.state === "committed", "transaction_state")
  naturalRequire(value.recordPath === recordPath && value.latestPath === null && value.worldId === worldId, "transaction_identity")
  naturalRequire(naturalInteger(value.tick) && naturalInteger(value.stateVersion), "transaction_counters")
  naturalRequire(typeof value.recordContentSha256 === "string" && SHA256.test(value.recordContentSha256), "transaction_content_hash")
  naturalRequire(value.state !== "prepared", "transaction_incomplete")
  return { tick: value.tick, stateVersion: value.stateVersion, recordContentSha256: value.recordContentSha256 }
}

export function assertNaturalWorldTransactionRecord(
  journal: ReturnType<typeof validateNaturalWorldTransactionJournal>,
  record: NaturalWorldRuntimeSaveRecord | null,
  identity: { ownerId: string; worldId: string },
): void {
  naturalRequire(record !== null, "transaction_record_missing")
  naturalRequire(record.ownerId === identity.ownerId && record.worldId === identity.worldId &&
    record.tick === journal.tick && record.stateVersion === journal.stateVersion &&
    record.recordContentSha256 === journal.recordContentSha256, "transaction_record_mismatch")
}
