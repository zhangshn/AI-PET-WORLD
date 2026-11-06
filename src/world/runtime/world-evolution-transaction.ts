import { createHash, randomUUID } from "node:crypto"
import { hostname } from "node:os"
import path from "node:path"
import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises"
import { assertRuntimePath, assertRuntimePathSegment } from "./runtime-path-security"
import { decodeNaturalWorldRuntimeRecord, sealNaturalWorldRuntimeRecord, validateNaturalWorldTransactionJournal,
  assertNaturalWorldTransactionRecord } from "./world-runtime-record-validation"
import type { NaturalWorldIdentity, NaturalWorldRuntimeRecordInput, NaturalWorldRuntimeSaveRecord,
  NaturalWorldEvolutionEvent, NaturalWorldTransitionWriteInput, NaturalWorldTransitionWriteResult,
  NaturalWorldTransitionQuery, NaturalWorldTransitionReceipt, NaturalWorldTransitionReadResult } from "./world-runtime-schema"

const IDS = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"] as const
const SHA = /^[a-f0-9]{64}$/u
const RECORD_LIMIT = 4 * 1024 * 1024
const EVENT_LIMIT = 256 * 1024
const JOURNAL_LIMIT = 32 * 1024
const PROTOCOL = "world-evolution-transaction-v1"
type ReadBudget = { bytes: number; reads: number; deadline: number }
function readBudget(): ReadBudget { return { bytes: 0, reads: 0, deadline: performance.now() + 15_000 } }
function need(v: unknown, why: string): asserts v { if (!v) throw new Error(`world_transition_invalid:${why}`) }
function errorCode(e: unknown): string | undefined { return (e as NodeJS.ErrnoException)?.code }
function message(e: unknown): string { return e instanceof Error ? e.message : String(e) }
function obj(v: unknown): asserts v is Record<string, unknown> {
  need(v !== null && typeof v === "object" && !Array.isArray(v), "object")
  need(Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null, "prototype")
  for (const k of Reflect.ownKeys(v)) { const d = Object.getOwnPropertyDescriptor(v, k)!
    need(typeof k === "string" && d.enumerable && Object.hasOwn(d, "value"), "accessor_or_symbol") }
}
function exact(v: unknown, keys: readonly string[]): asserts v is Record<string, unknown> {
  obj(v); need(Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)), "fields")
}
function hash(v: unknown): asserts v is string { need(typeof v === "string" && SHA.test(v), "hash") }
function text(v: unknown): asserts v is string { need(typeof v === "string" && v.trim().length > 0 && v.length <= 1024, "text") }
function count(v: unknown): asserts v is number { need(typeof v === "number" && Number.isSafeInteger(v) && v >= 0, "counter") }
function utc(v: unknown): number {
  need(typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(v), "utc")
  const ms = Date.parse(v); need(Number.isSafeInteger(ms) && new Date(ms).toISOString() === v, "utc"); return ms
}
/** Strict bounded ordinary JSON snapshot, before the first asynchronous step. */
function canonical(value: unknown, max = RECORD_LIMIT): string {
  let bytes = 0; const seen = new Set<object>()
  const add = (s: string) => { bytes += Buffer.byteLength(s); need(bytes <= max, "byte_budget"); return s }
  const walk = (v: unknown, depth: number): string => {
    need(depth <= 64, "depth")
    if (v === null || typeof v === "boolean") return add(JSON.stringify(v))
    if (typeof v === "string") { need(Buffer.byteLength(v) <= max - bytes, "byte_budget"); return add(JSON.stringify(v)) }
    if (typeof v === "number") { need(Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)), "number"); return add(JSON.stringify(v)) }
    need(typeof v === "object" && v !== null && !seen.has(v), "non_json_or_cycle"); seen.add(v)
    let result: string
    if (Array.isArray(v)) {
      need(Object.getPrototypeOf(v) === Array.prototype && v.length <= max && Reflect.ownKeys(v).length === v.length + 1, "array")
      result = add("[")
      for (let i = 0; i < v.length; i++) { const d = Object.getOwnPropertyDescriptor(v, String(i))
        need(d && d.enumerable && Object.hasOwn(d, "value"), "array_accessor_or_hole")
        if (i) result += add(","); result += walk(d.value, depth + 1) }
      result += add("]")
    } else { obj(v); result = add("{"); const keys = Object.keys(v).sort()
      for (let i = 0; i < keys.length; i++) { if (i) result += add(",")
        result += walk(keys[i], depth + 1) + add(":") + walk(Object.getOwnPropertyDescriptor(v, keys[i])!.value, depth + 1) }
      result += add("}") }
    seen.delete(v); return result
  }
  return walk(value, 0)
}
function sha(raw: string | Buffer): string { return createHash("sha256").update(raw).digest("hex") }
function digest(v: unknown): string { return sha(canonical(v)) }
function bytes(v: unknown, limit: number): Buffer { canonical(v, limit); const raw = Buffer.from(`${JSON.stringify(v, null, 2)}\n`); need(raw.length <= limit, "file_budget"); return raw }
function identity(v: unknown): asserts v is NaturalWorldIdentity {
  exact(v, IDS); IDS.forEach(k => text(v[k]))
  for (const k of ["ownerId", "worldId"] as const) { assertRuntimePathSegment(v[k] as string, k); need(!(v[k] as string).includes(":"), "ads") }
}
function idOf(v: NaturalWorldIdentity): NaturalWorldIdentity { return Object.fromEntries(IDS.map(k => [k, v[k]])) as NaturalWorldIdentity }
function sameId(a: NaturalWorldIdentity, b: NaturalWorldIdentity): void { need(IDS.every(k => a[k] === b[k]), "cross_world") }
function ref(v: unknown): void { exact(v, ["id", "version", "sha256"]); text(v.id); text(v.version); hash(v.sha256); need(v.id !== "latest" && v.version !== "latest", "mutable_reference") }
function refs(v: unknown): void { need(Array.isArray(v) && v.length <= 64, "refs"); v.forEach(ref) }
function reasons(v: unknown): void { need(Array.isArray(v) && v.length > 0 && v.length <= 64, "reasons"); v.forEach(hash) }

export function computeWorldEvolutionBusinessKey(event: Omit<NaturalWorldEvolutionEvent, "eventSha256">): string {
  canonical(event, EVENT_LIMIT)
  const branch = event.evidence.kind === "evolution"
    ? { capabilityRef: event.evidence.capabilityRef, modelRef: event.evidence.modelRef }
    : { maintenanceContext: event.evidence.maintenanceContext }
  return digest({ schemaVersion: "world-evolution-task-v1", taskKind: event.eventKind, identity: event.identity,
    before: event.before, interval: event.interval, policyRef: event.policyRef, ...branch,
    externalInputRefs: event.externalInputRefs, historyInputRef: event.historyInputRef })
}
export function computeWorldEvolutionDomainSha(input: NaturalWorldRuntimeRecordInput): string {
  canonical(input); const r = structuredClone(input)
  const evolution = r.worldState.payload.environment.evolution
  if (evolution !== undefined) { obj(evolution); delete evolution.commit }
  return digest({ ...idOf(r), worldFacts: r.worldFacts, worldState: r.worldState, ruleVersion: r.ruleVersion,
    randomState: r.randomState, eventCursor: r.eventCursor, tick: r.tick, stateVersion: r.stateVersion })
}
export function sealWorldEvolutionEvent(input: Omit<NaturalWorldEvolutionEvent, "eventSha256">): NaturalWorldEvolutionEvent {
  canonical(input, EVENT_LIMIT)
  need(!Object.hasOwn(input, "eventSha256"), "event_already_sealed")
  const event = { ...structuredClone(input), eventSha256: digest(input) }
  validateEvent(event); return event
}
function validateEvent(v: unknown): asserts v is NaturalWorldEvolutionEvent {
  canonical(v, EVENT_LIMIT)
  exact(v, ["schemaVersion", "identity", "eventId", "businessKey", "cursor", "eventKind", "fromTick", "toTick", "fromStateVersion", "toStateVersion", "before", "interval", "policyRef", "externalInputRefs", "historyInputRef", "evidence", "changes", "reasonRefs", "previousEventSha256", "domainAfterSha256", "eventSha256"])
  need(v.schemaVersion === "world-evolution-event-v1", "event_schema"); identity(v.identity); text(v.eventId)
  for (const k of ["businessKey", "domainAfterSha256", "eventSha256"]) hash(v[k])
  if (v.previousEventSha256 !== null) hash(v.previousEventSha256)
  for (const k of ["cursor", "fromTick", "toTick", "fromStateVersion", "toStateVersion"]) count(v[k])
  exact(v.before, ["expectedTick", "expectedStateVersion", "expectedFileSha256", "worldFactsPayloadSha256", "statePayloadSha256", "recordContentSha256"])
  count(v.before.expectedTick); count(v.before.expectedStateVersion)
  for (const k of ["expectedFileSha256", "worldFactsPayloadSha256", "statePayloadSha256", "recordContentSha256"]) hash(v.before[k])
  need(v.before.expectedTick === v.fromTick && v.before.expectedStateVersion === v.fromStateVersion && v.toStateVersion === (v.fromStateVersion as number) + 1, "event_counters")
  exact(v.interval, ["logicalStartUtc", "logicalEndUtc", "durationSeconds"])
  const start = utc(v.interval.logicalStartUtc), end = utc(v.interval.logicalEndUtc), duration = v.interval.durationSeconds
  need(typeof duration === "number" && Number.isSafeInteger(duration * 1000) && duration * 1000 === end - start, "duration")
  ref(v.policyRef); refs(v.externalInputRefs); ref(v.historyInputRef); reasons(v.reasonRefs)
  obj(v.evidence)
  if (v.eventKind === "evolution") {
    need(duration > 0 && v.toTick === (v.fromTick as number) + 1, "evolution_time")
    exact(v.evidence, ["kind", "capabilityRef", "modelRef", "inputRef", "outputRef", "validatorRef"])
    need(v.evidence.kind === "evolution", "evidence_branch")
    for (const k of ["capabilityRef", "modelRef", "inputRef", "outputRef", "validatorRef"]) ref(v.evidence[k])
  } else {
    need(v.eventKind === "maintenance" && duration === 0 && v.toTick === v.fromTick, "maintenance_time")
    exact(v.evidence, ["kind", "maintenanceContext", "migrationArtifactRef", "validationRef"])
    need(v.evidence.kind === "maintenance", "evidence_branch")
    const c = v.evidence.maintenanceContext
    exact(c, ["targetPolicyRef", "targetRuleVersion", "targetModelRef", "migrationEvidenceRef", "executorId"])
    ref(c.targetPolicyRef); ref(c.targetModelRef); ref(c.migrationEvidenceRef); text(c.targetRuleVersion); text(c.executorId)
    ref(v.evidence.migrationArtifactRef); ref(v.evidence.validationRef)
  }
  need(Array.isArray(v.changes) && v.changes.length <= 256, "changes")
  const fields = new Set<string>()
  for (const c of v.changes) {
    exact(c, ["fieldId", "operation", "beforeValueSha256", "newValue", "reasonRefs"]); text(c.fieldId)
    need(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(c.fieldId) && !fields.has(c.fieldId), "field_id"); fields.add(c.fieldId)
    need(c.operation === "set" || c.operation === "replace", "operation"); hash(c.beforeValueSha256); reasons(c.reasonRefs)
  }
  const withoutHash = Object.fromEntries(Object.entries(v).filter(([k]) => k !== "eventSha256"))
  need(digest(withoutHash) === v.eventSha256, "event_hash")
  need(computeWorldEvolutionBusinessKey(v as NaturalWorldEvolutionEvent) === v.businessKey, "business_key")
}
type Commit = { businessKey: string; eventId: string; eventSha256: string; historyHead: { cursor: number; eventSha256: string } }
function commitOf(record: NaturalWorldRuntimeSaveRecord): Commit | null {
  const evolution = record.worldState.payload.environment.evolution
  if (evolution === undefined) return null
  obj(evolution)
  if (!Object.hasOwn(evolution, "commit")) return null
  const c = evolution.commit
  exact(c, ["businessKey", "eventId", "eventSha256", "historyHead"]); hash(c.businessKey); text(c.eventId); hash(c.eventSha256)
  exact(c.historyHead, ["cursor", "eventSha256"]); count(c.historyHead.cursor); hash(c.historyHead.eventSha256)
  need(c.historyHead.cursor === record.eventCursor && c.historyHead.eventSha256 === c.eventSha256, "history_head")
  return c as Commit
}
function validatePair(before: { record: NaturalWorldRuntimeSaveRecord; fileSha256: string }, next: NaturalWorldRuntimeSaveRecord, event: NaturalWorldEvolutionEvent): void {
  sameId(before.record, next); sameId(next, event.identity)
  const b = event.before, r = before.record
  need(b.expectedTick === r.tick && b.expectedStateVersion === r.stateVersion && b.expectedFileSha256 === before.fileSha256 && b.worldFactsPayloadSha256 === r.worldFactsPayloadSha256 && b.statePayloadSha256 === r.statePayloadSha256 && b.recordContentSha256 === r.recordContentSha256, "before_binding")
  need(next.tick === event.toTick && next.stateVersion === event.toStateVersion && next.eventCursor === r.eventCursor + 1 && next.eventCursor === event.cursor, "next_counters")
  const previous = commitOf(r), c = commitOf(next)
  need(event.previousEventSha256 === (previous?.eventSha256 ?? null), "previous_event")
  need(previous !== null || r.eventCursor === 0, "missing_previous_commit")
  const oldEvolution = r.worldState.payload.environment.evolution
  const newEvolution = next.worldState.payload.environment.evolution
  obj(newEvolution)
  need(newEvolution.logicalEndUtc === event.interval.logicalEndUtc, "next_logical_end")
  if (oldEvolution !== undefined) {
    obj(oldEvolution)
    need(oldEvolution.logicalEndUtc === event.interval.logicalStartUtc, "before_logical_end")
  } else need(event.eventKind === "maintenance" && r.eventCursor === 0, "logical_anchor_missing")
  if (event.eventKind === "maintenance") need(digest(r.randomState) === digest(next.randomState), "maintenance_rng_change_unsupported")
  need(c && c.businessKey === event.businessKey && c.eventId === event.eventId && c.eventSha256 === event.eventSha256, "next_commit")
  need(computeWorldEvolutionDomainSha(next) === event.domainAfterSha256, "domain_after")
}
export function snapshotNaturalWorldTransition(input: NaturalWorldTransitionWriteInput): NaturalWorldTransitionWriteInput {
  canonical(input, RECORD_LIMIT + EVENT_LIMIT + 4096)
  exact(input, ["record", "event", "expectedTick", "expectedStateVersion", "expectedFileSha256"])
  count(input.expectedTick); count(input.expectedStateVersion); hash(input.expectedFileSha256)
  const record = sealNaturalWorldRuntimeRecord(input.record); validateEvent(input.event)
  need(input.expectedTick === input.event.before.expectedTick && input.expectedStateVersion === input.event.before.expectedStateVersion && input.expectedFileSha256 === input.event.before.expectedFileSha256, "request_cas")
  sameId(record, input.event.identity); commitOf(record)
  return { ...structuredClone(input), record }
}
export function snapshotNaturalWorldTransitionQuery(input: NaturalWorldTransitionQuery): NaturalWorldTransitionQuery {
  canonical(input, JOURNAL_LIMIT); exact(input, ["identity", "businessKey"]); identity(input.identity); hash(input.businessKey); return structuredClone(input)
}
type Sidecar = { name: string; fileSha256: string; bytes: number }
type Journal = {
  schemaVersion: "world-runtime-transaction-v1"; protocolVersion: "world-evolution-transaction-v1"; recordKind: "natural_world"
  state: "prepared" | "committed"; transactionId: string; recordPath: string; latestPath: null
  worldId: string; identity: NaturalWorldIdentity; businessKey: string; eventSha256: string
  tick: number; stateVersion: number; recordContentSha256: string
  before: Sidecar; next: Sidecar; event: Sidecar
}
function location(root: string, id: Pick<NaturalWorldIdentity, "ownerId" | "worldId">): string { return path.join(path.resolve(root), id.ownerId, `${id.worldId}.json`) }
function sidePath(recordPath: string, name: string): string { return path.join(`${recordPath}.evolution`, name) }
function sideName(key: string, hashValue: string, kind: string): string { return `${key}.${hashValue}.${kind}.json` }
function receiptPath(p: string, key: string): string { return sidePath(p, `${key}.receipt.json`) }
function commitPath(p: string, key: string, eventSha: string): string { return sidePath(p, sideName(key, eventSha, "commit")) }
async function guarded(root: string, p: string): Promise<string> {
  const result = await assertRuntimePath(p, root)
  try { const s = await lstat(result); need(!s.isSymbolicLink() && (s.isDirectory() || s.nlink === 1), "link_rejected") }
  catch (e) { if (errorCode(e) !== "ENOENT") throw e }
  return result
}
async function rawFile(root: string, p: string, limit: number, budget?: ReadBudget): Promise<Buffer | null> {
  if (budget) need(++budget.reads <= 256 && performance.now() <= budget.deadline, "read_budget")
  await guarded(root, p)
  try { const st = await lstat(p); need(st.isFile() && st.size <= limit, "file_size_or_kind")
    if (budget) { budget.bytes += st.size; need(budget.bytes <= 64 * 1024 * 1024, "read_byte_budget") }
    const raw = await readFile(p); need(raw.length <= limit, "file_size"); return raw }
  catch (e) { if (errorCode(e) === "ENOENT") return null; throw e }
}
function parse(raw: Buffer): unknown { return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw)) }
async function atomic(root: string, p: string, raw: Buffer, immutable = false): Promise<void> {
  await guarded(root, p); await mkdir(path.dirname(p), { recursive: true }); await guarded(root, p)
  if (immutable) { const old = await rawFile(root, p, Math.max(RECORD_LIMIT, raw.length)); if (old) { need(old.equals(raw), "immutable_collision"); return } }
  const temp = `${p}.${randomUUID()}.tmp`; await guarded(root, temp)
  const file = await open(temp, "wx")
  try { await file.writeFile(raw); await file.sync() } finally { await file.close() }
  // All callers hold the original world lock. No other cooperating writer may
  // race the immutable existence check; preexisting bytes are never replaced.
  await guarded(root, p); await rename(temp, p)
}
function validateJournal(v: unknown, p: string, id: NaturalWorldIdentity): asserts v is Journal {
  canonical(v, JOURNAL_LIMIT)
  exact(v, ["schemaVersion", "protocolVersion", "recordKind", "state", "transactionId", "recordPath", "latestPath", "worldId", "identity", "businessKey", "eventSha256", "tick", "stateVersion", "recordContentSha256", "before", "next", "event"])
  need(v.schemaVersion === "world-runtime-transaction-v1" && v.protocolVersion === PROTOCOL && v.recordKind === "natural_world", "journal_protocol")
  need(v.state === "prepared" || v.state === "committed", "journal_state")
  need(v.recordPath === p && v.latestPath === null && v.worldId === id.worldId, "journal_location")
  identity(v.identity); sameId(v.identity, id); hash(v.businessKey); hash(v.eventSha256); hash(v.transactionId); hash(v.recordContentSha256); count(v.tick); count(v.stateVersion)
  for (const role of ["before", "next", "event"] as const) {
    const s = v[role]; exact(s, ["name", "fileSha256", "bytes"]); hash(s.fileSha256); count(s.bytes)
    need(s.bytes > 0 && s.bytes <= (role === "event" ? EVENT_LIMIT : RECORD_LIMIT), "sidecar_budget")
    need(s.name === sideName(v.businessKey, role === "event" ? v.eventSha256 : s.fileSha256, role === "next" ? "record" : role), "sidecar_path")
  }
  const body = Object.fromEntries(Object.entries(v).filter(([k]) => k !== "state" && k !== "transactionId"))
  need(digest(body) === v.transactionId, "transaction_id")
}
async function loadJournal(root: string, p: string, id: NaturalWorldIdentity): Promise<Journal | null> {
  const raw = await rawFile(root, `${p}.transaction.json`, JOURNAL_LIMIT)
  if (!raw) return null
  const j = parse(raw); validateJournal(j, p, id); return j
}
async function side(root: string, p: string, s: Sidecar, limit: number, budget: ReadBudget): Promise<Buffer> {
  const raw = await rawFile(root, sidePath(p, s.name), limit, budget)
  need(raw && raw.length === s.bytes && sha(raw) === s.fileSha256, "sidecar_missing_or_hash"); return raw
}
async function bundle(root: string, p: string, j: Journal, budget: ReadBudget) {
  const beforeRaw = await side(root, p, j.before, RECORD_LIMIT, budget), nextRaw = await side(root, p, j.next, RECORD_LIMIT, budget)
  const before = decodeNaturalWorldRuntimeRecord(beforeRaw), next = decodeNaturalWorldRuntimeRecord(nextRaw)
  const e = parse(await side(root, p, j.event, EVENT_LIMIT, budget)); validateEvent(e)
  sameId(j.identity, before.record); validatePair(before, next.record, e)
  need(e.businessKey === j.businessKey && e.eventSha256 === j.eventSha256 && next.record.tick === j.tick && next.record.stateVersion === j.stateVersion && next.record.recordContentSha256 === j.recordContentSha256, "journal_bundle")
  return { before, next, nextRaw, event: e }
}
function makeReceipt(j: Journal, record: NaturalWorldRuntimeSaveRecord): NaturalWorldTransitionReceipt {
  return { schemaVersion: "world-evolution-receipt-v1", identity: j.identity, businessKey: j.businessKey,
    eventId: commitOf(record)!.eventId, eventSha256: j.eventSha256, fileSha256: j.next.fileSha256,
    recordContentSha256: j.recordContentSha256, tick: j.tick, stateVersion: j.stateVersion, eventCursor: record.eventCursor,
    transportOnly: true, productionReady: false }
}
async function committedBundle(root: string, p: string, id: NaturalWorldIdentity, c: Commit, budget: ReadBudget) {
  const raw = await rawFile(root, commitPath(p, c.businessKey, c.eventSha256), JOURNAL_LIMIT, budget)
  need(raw, "commit_marker_missing")
  const j = parse(raw); validateJournal(j, p, id)
  need(j.state === "committed" && j.businessKey === c.businessKey && j.eventSha256 === c.eventSha256, "commit_marker")
  const b = await bundle(root, p, j, budget)
  need(b.event.eventId === c.eventId && b.event.cursor === c.historyHead.cursor, "commit_head_binding")
  return { ...b, journal: j }
}
/** Original natural readers call this. No GET performs recovery or writes state. */
export async function readVerifiedNaturalRecord(root: string, p: string, requested: { ownerId: string; worldId: string }, budget = readBudget()) {
  const raw = await rawFile(root, p, RECORD_LIMIT, budget)
  const journalRaw = await rawFile(root, `${p}.transaction.json`, JOURNAL_LIMIT, budget)
  let current: ReturnType<typeof decodeNaturalWorldRuntimeRecord> | null = raw ? decodeNaturalWorldRuntimeRecord(raw) : null
  if (current) need(current.record.ownerId === requested.ownerId && current.record.worldId === requested.worldId, "requested_identity")
  if (journalRaw) {
    const j = parse(journalRaw); obj(j)
    if (Object.hasOwn(j, "protocolVersion")) {
      need(current, "journal_record_missing"); validateJournal(j, p, idOf(current.record))
      need(j.state === "committed", "transaction_incomplete")
      const b = await bundle(root, p, j, budget)
      need(current.fileSha256 === b.next.fileSha256, "journal_record_mismatch")
    } else {
      const old = validateNaturalWorldTransactionJournal(j, p, requested.worldId)
      assertNaturalWorldTransactionRecord(old, current?.record ?? null, requested)
    }
  }
  if (current) {
    const c = commitOf(current.record)
    if (c) { const b = await committedBundle(root, p, idOf(current.record), c, budget)
      need(b.next.fileSha256 === current.fileSha256, "current_commit_record") }
  }
  // A second state read detects a concurrent replacement during verification.
  const after = await rawFile(root, p, RECORD_LIMIT, budget)
  need((raw === null && after === null) || (raw !== null && after !== null && raw.equals(after)), "concurrent_read")
  current = raw ? decodeNaturalWorldRuntimeRecord(raw) : null
  return current
}
async function lookup(root: string, p: string, query: NaturalWorldTransitionQuery, budget = readBudget()) {
  const current = await readVerifiedNaturalRecord(root, p, query.identity, budget)
  if (current) sameId(current.record, query.identity)
  const receiptRaw = await rawFile(root, receiptPath(p, query.businessKey), JOURNAL_LIMIT, budget)
  if (!receiptRaw) {
    need(!current || commitOf(current.record)?.businessKey !== query.businessKey, "committed_receipt_missing")
    return null
  }
  const receipt = parse(receiptRaw); obj(receipt); hash(receipt.eventSha256); text(receipt.eventId); count(receipt.eventCursor)
  const b = await committedBundle(root, p, query.identity, { businessKey: query.businessKey, eventId: receipt.eventId,
    eventSha256: receipt.eventSha256, historyHead: { cursor: receipt.eventCursor, eventSha256: receipt.eventSha256 } }, budget)
  const expected = makeReceipt(b.journal, b.next.record)
  need(canonical(receipt, JOURNAL_LIMIT) === canonical(expected, JOURNAL_LIMIT), "receipt_binding")
  need(current && current.record.eventCursor >= expected.eventCursor, "receipt_not_current_ancestor")
  let cursor = current
  need(current.record.eventCursor - expected.eventCursor <= 32, "ancestry_budget")
  while (cursor.record.eventCursor > expected.eventCursor) {
    const head = commitOf(cursor.record); need(head, "ancestry_commit")
    const previous = await committedBundle(root, p, query.identity, head, budget)
    need(previous.next.fileSha256 === cursor.fileSha256, "ancestry_file")
    cursor = previous.before
  }
  need(cursor.fileSha256 === expected.fileSha256, "receipt_not_ancestor")
  return { receipt: expected, event: b.event }
}

async function release(root: string, p: string, token: string): Promise<void> {
  try { const raw = await rawFile(root, p, JOURNAL_LIMIT); if (!raw) return
    const lock = parse(raw); obj(lock); if (lock.lockToken === token) { await guarded(root, p); await rm(p) } }
  catch { /* Never remove a lock whose ownership cannot be established. */ }
}
async function createLock(root: string, p: string, id: NaturalWorldIdentity): Promise<string> {
  await guarded(root, p); const token = randomUUID(); const f = await open(p, "wx")
  try { await f.writeFile(bytes({ schemaVersion: "world-runtime-write-lock-v1", pid: process.pid, host: hostname(),
    worldId: id.worldId, ownerId: id.ownerId, lockToken: token, createdAtUtc: new Date().toISOString() }, JOURNAL_LIMIT)); await f.sync() }
  catch (e) { await f.close(); await release(root, p, token); throw e }
  await f.close(); return token
}
function deadLock(raw: Buffer, id: NaturalWorldIdentity): string {
  const lock = parse(raw)
  exact(lock, ["schemaVersion", "pid", "host", "worldId", "ownerId", "lockToken", "createdAtUtc"])
  need(lock.schemaVersion === "world-runtime-write-lock-v1" && lock.host === hostname() && lock.worldId === id.worldId && lock.ownerId === id.ownerId, "lock_not_owned_host_world")
  need(typeof lock.pid === "number" && Number.isSafeInteger(lock.pid) && lock.pid > 0, "lock_pid")
  need(typeof lock.lockToken === "string" && /^[a-f0-9-]{36}$/u.test(lock.lockToken), "lock_token"); utc(lock.createdAtUtc)
  let absent = false
  try { process.kill(lock.pid, 0) } catch (e) { absent = errorCode(e) === "ESRCH" }
  need(absent, "lock_process_active_or_unknown"); return lock.lockToken
}
async function acquire(root: string, p: string, id: NaturalWorldIdentity, recover: boolean): Promise<string> {
  await mkdir(path.dirname(p), { recursive: true })
  try { return await createLock(root, `${p}.lock`, id) }
  catch (e) { if (errorCode(e) !== "EEXIST" || !recover) throw e }
  // Only explicit recovery may reclaim an exactly identified dead local owner.
  // The gate serializes reclaimers. Unknown, active or remote locks are retained.
  const gate = `${p}.lock.recovery`; const gateToken = await createLock(root, gate, id)
  try {
    const original = await rawFile(root, `${p}.lock`, JOURNAL_LIMIT)
    if (!original) return await createLock(root, `${p}.lock`, id)
    const token = deadLock(original, id)
    const reread = await rawFile(root, `${p}.lock`, JOURNAL_LIMIT)
    need(reread && reread.equals(original), "lock_changed"); deadLock(reread, id)
    const abandoned = `${p}.lock.abandoned.${token}`
    await guarded(root, abandoned); need(await rawFile(root, abandoned, JOURNAL_LIMIT) === null, "abandoned_lock_exists")
    await rename(`${p}.lock`, abandoned)
    return await createLock(root, `${p}.lock`, id)
  } finally { await release(root, gate, gateToken) }
}
function success(p: string, receipt: NaturalWorldTransitionReceipt, replayed: boolean): NaturalWorldTransitionWriteResult {
  return { ok: true, path: p, message: replayed ? "Verified original transition receipt." : "State and event transaction committed.",
    warnings: [], tags: ["natural_world_transition", "transport_only"], receipt, replayed }
}
function failure(p: string, e: unknown): NaturalWorldTransitionWriteResult {
  const m = message(e)
  return { ok: false, code: errorCode(e) === "EEXIST" || /cas|lock|conflict/u.test(m) ? "conflict" : "persistence_error",
    path: p, message: m, warnings: [m], tags: ["natural_world_transition", "blocked", "evidence_preserved"] }
}
async function finalize(root: string, p: string, j: Journal, budget = readBudget()) {
  const b = await bundle(root, p, j, budget)
  const priorCommit = commitOf(b.before.record)
  if (priorCommit) {
    const prior = await committedBundle(root, p, j.identity, priorCommit, budget)
    need(prior.next.fileSha256 === b.before.fileSha256 && prior.event.interval.logicalEndUtc === b.event.interval.logicalStartUtc, "recovery_previous_commit")
  }
  const currentRaw = await rawFile(root, p, RECORD_LIMIT, budget); need(currentRaw, "recovery_record_missing")
  const current = decodeNaturalWorldRuntimeRecord(currentRaw)
  if (current.fileSha256 === j.before.fileSha256) {
    need(j.state === "prepared", "committed_old_state")
    await atomic(root, p, b.nextRaw)
  } else need(current.fileSha256 === j.next.fileSha256, "recovery_cas_conflict")
  const committed: Journal = { ...j, state: "committed" }
  await atomic(root, commitPath(p, j.businessKey, j.eventSha256), bytes(committed, JOURNAL_LIMIT), true)
  await atomic(root, `${p}.transaction.json`, bytes(committed, JOURNAL_LIMIT))
  const receipt = makeReceipt(committed, b.next.record)
  await atomic(root, receiptPath(p, j.businessKey), bytes(receipt, JOURNAL_LIMIT), true)
  await guarded(root, `${p}.transaction.json`); await rm(`${p}.transaction.json`)
  return receipt
}
export async function writeNaturalTransitionAt(root: string, input: NaturalWorldTransitionWriteInput): Promise<NaturalWorldTransitionWriteResult> {
  let p = "", token: string | null = null
  try {
    const fixed = snapshotNaturalWorldTransition(input), id = fixed.event.identity
    p = location(root, id); await guarded(root, p); token = await acquire(root, p, id, false)
    const oldReceipt = await lookup(root, p, { identity: id, businessKey: fixed.event.businessKey })
    if (oldReceipt) {
      need(oldReceipt.event.eventSha256 === fixed.event.eventSha256 && oldReceipt.receipt.recordContentSha256 === sealNaturalWorldRuntimeRecord(fixed.record).recordContentSha256, "duplicate_key_payload_conflict")
      return success(p, oldReceipt.receipt, true)
    }
    const current = await readVerifiedNaturalRecord(root, p, id); need(current, "before_missing")
    need(current.fileSha256 === fixed.expectedFileSha256 && current.record.tick === fixed.expectedTick && current.record.stateVersion === fixed.expectedStateVersion, "cas_rejected")
    const next = sealNaturalWorldRuntimeRecord(fixed.record); validatePair(current, next, fixed.event)
    const previous = commitOf(current.record)
    if (previous) { const b = await committedBundle(root, p, id, previous, readBudget())
      need(b.event.interval.logicalEndUtc === fixed.event.interval.logicalStartUtc, "interval_chain") }
    const oldRaw = await rawFile(root, p, RECORD_LIMIT); need(oldRaw && sha(oldRaw) === current.fileSha256, "cas_file_changed")
    const nextRaw = bytes(next, RECORD_LIMIT), eventRaw = bytes(fixed.event, EVENT_LIMIT), key = fixed.event.businessKey
    const makeSide = (raw: Buffer, kind: string, namingHash = sha(raw)): Sidecar => ({ name: sideName(key, namingHash, kind), fileSha256: sha(raw), bytes: raw.length })
    const body = { schemaVersion: "world-runtime-transaction-v1" as const, protocolVersion: PROTOCOL as typeof PROTOCOL,
      recordKind: "natural_world" as const, recordPath: p, latestPath: null, worldId: id.worldId, identity: id,
      businessKey: key, eventSha256: fixed.event.eventSha256, tick: next.tick, stateVersion: next.stateVersion,
      recordContentSha256: next.recordContentSha256, before: makeSide(oldRaw, "before"), next: makeSide(nextRaw, "record"), event: makeSide(eventRaw, "event", fixed.event.eventSha256) }
    const journal: Journal = { ...body, state: "prepared", transactionId: digest(body) }
    validateJournal(journal, p, id)
    await atomic(root, `${p}.transaction.json`, bytes(journal, JOURNAL_LIMIT))
    for (const [s, raw] of [[journal.before, oldRaw], [journal.next, nextRaw], [journal.event, eventRaw]] as const)
      await atomic(root, sidePath(p, s.name), raw, true)
    return success(p, await finalize(root, p, journal), false)
  } catch (e) { return failure(p, e) }
  finally { if (token) await release(root, `${p}.lock`, token) }
}
export async function readNaturalTransitionAt(root: string, input: NaturalWorldTransitionQuery): Promise<NaturalWorldTransitionReadResult> {
  let p = ""
  try { const q = snapshotNaturalWorldTransitionQuery(input); p = location(root, q.identity)
    const found = await lookup(root, p, q)
    return { status: found ? "found" : "empty", path: p, message: found ? "Verified committed transaction." : "No committed receipt for this business key.", receipt: found?.receipt ?? null, event: found?.event ?? null }
  } catch (e) { return { status: "invalid", path: p, message: message(e), receipt: null, event: null } }
}
export async function recoverNaturalTransitionAt(root: string, input: NaturalWorldTransitionQuery): Promise<NaturalWorldTransitionWriteResult> {
  let p = "", token: string | null = null
  try { const q = snapshotNaturalWorldTransitionQuery(input); p = location(root, q.identity)
    await guarded(root, p); token = await acquire(root, p, q.identity, true)
    const j = await loadJournal(root, p, q.identity)
    if (!j) { const prior = await lookup(root, p, q); need(prior, "no_recoverable_transaction"); return success(p, prior.receipt, true) }
    need(j.businessKey === q.businessKey, "recovery_business_key")
    return success(p, await finalize(root, p, j), true)
  } catch (e) { return failure(p, e) }
  finally { if (token) await release(root, `${p}.lock`, token) }
}
