import { createHash } from "node:crypto"
import { types } from "node:util"
import { validateWorldEvolutionPolicy, validateFixedEnvironmentPolicyFields, FIXED_ENVIRONMENT_FIELD_DESCRIPTORS } from "./world-evolution-policy"

export type WorldEnvironmentFieldId = typeof FIXED_ENVIRONMENT_FIELD_DESCRIPTORS[number]["fieldId"]
export type WorldEnvironmentValues = Readonly<Record<WorldEnvironmentFieldId, number>>
export type WorldEnvironmentDeltaValidation = Readonly<{
  nextValues: WorldEnvironmentValues
  domainValid: true
  productionAdmitted: false
  evidenceVerified: false
}>
const FIELD_IDS = FIXED_ENVIRONMENT_FIELD_DESCRIPTORS.map(d => d.fieldId)
// Allocation limits for a component input; not production execution policy.
const MAX_BYTES = 512 * 1024, MAX_NODES = 16384, MAX_DEPTH = 40, MAX_ARRAY = 256
function need(ok: unknown, why: string): asserts ok { if (!ok) throw new Error("world_environment_delta_invalid:" + why) }
function object(value: unknown): asserts value is Record<string, unknown> {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "object")
}
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  object(value); need(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), "fields")
}

/** Fix all caller input synchronously before inspecting it. No getter/toJSON/Proxy execution. */
function snapshot(value: unknown): unknown {
  let bytes = 0, nodes = 0
  const ancestors = new Set<object>()
  const add = (s: string) => { bytes += Buffer.byteLength(s, "utf8"); need(bytes <= MAX_BYTES, "byte_limit"); return s }
  const walk = (v: unknown, depth: number): string => {
    need(++nodes <= MAX_NODES && depth <= MAX_DEPTH, "shape_limit")
    if (v === null || typeof v === "boolean") return add(JSON.stringify(v))
    if (typeof v === "number") { need(Number.isFinite(v) && (!Number.isInteger(v) || Number.isSafeInteger(v)), "finite_number"); return add(JSON.stringify(v)) }
    if (typeof v === "string") { need(Buffer.byteLength(v, "utf8") <= MAX_BYTES - bytes, "byte_limit"); return add(JSON.stringify(v)) }
    need(typeof v === "object" && v !== null && !types.isProxy(v), "ordinary_json")
    need(!ancestors.has(v), "cycle"); ancestors.add(v)
    const array = Array.isArray(v), prototype = Object.getPrototypeOf(v)
    need(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, "prototype")
    const keys = Reflect.ownKeys(v)
    let encoded: string
    if (array) {
      need(v.length <= MAX_ARRAY && keys.length === v.length + 1 && keys.includes("length"), "array_shape")
      encoded = add("[")
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i))
        need(d?.enumerable && Object.hasOwn(d, "value"), "array_accessor_or_hole")
        if (i) encoded += add(",")
        encoded += walk(d.value, depth + 1)
      }
      encoded += add("]")
    } else {
      need(keys.length <= MAX_ARRAY, "object_size")
      for (const key of keys) {
        const d = Object.getOwnPropertyDescriptor(v, key)!
        need(typeof key === "string" && !["__proto__", "prototype", "constructor"].includes(key) && d.enumerable && Object.hasOwn(d, "value"), "object_accessor_or_key")
      }
      encoded = add("{")
      for (const [i, key] of (keys as string[]).sort().entries()) {
        if (i) encoded += add(",")
        need(Buffer.byteLength(key, "utf8") <= MAX_BYTES - bytes, "byte_limit")
        encoded += add(JSON.stringify(key)) + add(":") + walk(Object.getOwnPropertyDescriptor(v, key)!.value, depth + 1)
      }
      encoded += add("}")
    }
    ancestors.delete(v); return encoded
  }
  return JSON.parse(walk(value, 0))
}
function utc(value: unknown): number {
  need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value), "utc_format")
  const ms = Date.parse(value)
  need(Number.isSafeInteger(ms) && new Date(ms).toISOString() === value, "utc_roundtrip")
  return ms
}
function finiteInRange(value: unknown, min: number, max: number): asserts value is number {
  need(typeof value === "number" && Number.isFinite(value) && value >= min && value <= max, "field_value")
}
function reasons(value: unknown): void {
  need(Array.isArray(value) && value.length > 0 && value.length <= 64, "reason_refs")
  need(value.every(v => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v)) && new Set(value).size === value.length, "reason_refs")
}

/**
 * Checks numeric replacements against the supplied policy, not production fitness.
 * All four values must already exist; cold-start set and unavailable states are unsupported.
 * The caller must independently prove the Store anchor, actual forward/model identity,
 * immutable policy/evidence, reason authenticity, resource admission and transaction CAS.
 */
export function validateWorldEnvironmentDelta(value: unknown): WorldEnvironmentDeltaValidation {
  const v = snapshot(value)
  exact(v, ["policy", "identity", "interval", "beforeValues", "changes", "result"])
  // Always reparse the raw policy. A caller-supplied shapeValid wrapper is not a policy.
  const { policy } = validateWorldEvolutionPolicy(v.policy, v.identity)
  const { fields } = validateFixedEnvironmentPolicyFields(policy.domainFields)
  need(fields.length === 4 && FIELD_IDS.every(id => fields.some(f => f.fieldId === id)), "four_existing_fields_required")
  const registered = new Map(fields.map(f => [f.fieldId, f]))
  for (const f of fields) need(f.missingPolicy === "reject" && f.allowedOps.includes("replace"), "unsupported_field_policy")
  exact(v.interval, ["logicalStartUtc", "logicalEndUtc", "durationSeconds"])
  const start = utc(v.interval.logicalStartUtc), end = utc(v.interval.logicalEndUtc), span = v.interval.durationSeconds
  need(typeof span === "number" && Number.isFinite(span) && span > 0 && Number.isSafeInteger(span * 1000) && Number.isSafeInteger(end - start) && end - start === span * 1000, "interval_span")
  need(span === policy.timePolicy.stepSeconds && span === policy.timePolicy.modelHorizonSeconds, "policy_span")
  exact(v.beforeValues, FIELD_IDS)
  const next: Record<string, number> = {}
  for (const id of FIELD_IDS) {
    const f = registered.get(id)!
    need(f.dataType === "number", "number_field")
    finiteInRange(v.beforeValues[id], f.constraints.min, f.constraints.max)
    next[id] = v.beforeValues[id]
  }
  need(v.result === "changes" || v.result === "no_change", "result")
  need(Array.isArray(v.changes) && v.changes.length <= 4, "changes")
  if (v.result === "no_change") need(v.changes.length === 0, "no_change_changes")
  else need(v.changes.length > 0, "empty_changes")
  const changed = new Set<string>(); let actualDifference = false
  for (const change of v.changes) {
    exact(change, ["fieldId", "operation", "beforeValueSha256", "newValue", "reasonRefs"])
    need(typeof change.fieldId === "string" && registered.has(change.fieldId) && !changed.has(change.fieldId), "field_id")
    need(change.operation === "replace", "operation")
    const f = registered.get(change.fieldId)!
    need(f.dataType === "number", "number_field")
    const before = next[change.fieldId]
    need(typeof change.beforeValueSha256 === "string" && /^[a-f0-9]{64}$/u.test(change.beforeValueSha256) && createHash("sha256").update(JSON.stringify(before), "utf8").digest("hex") === change.beforeValueSha256, "before_sha256")
    finiteInRange(change.newValue, f.constraints.min, f.constraints.max); reasons(change.reasonRefs)
    changed.add(change.fieldId); actualDifference ||= change.newValue !== before; next[change.fieldId] = change.newValue
  }
  need(v.result !== "changes" || actualDifference, "no_actual_change")
  return Object.freeze({ nextValues: Object.freeze(next) as WorldEnvironmentValues, domainValid: true, productionAdmitted: false, evidenceVerified: false })
}
