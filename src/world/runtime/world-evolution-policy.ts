import { createHash } from "node:crypto"
import { types } from "node:util"
import { validateWorldEvolutionTimePolicy } from "./world-evolution-clock"
import type { WorldEvolutionTimePolicy } from "./world-evolution-clock"

/** ARCH4.4.2 syntax only. No I/O, source attestation, registration or execution. */
export type WorldEvolutionPolicyRef = Readonly<{ id: string; version: string; sha256: string }>
export type WorldEvolutionPolicyIdentity = Readonly<{
  ownerId: string; playerId: string; worldId: string
  worldSeed: string; worldProfileId: string; regionId: string
}>
export type WorldEvolutionDomainField = Readonly<{
  fieldId: string; adapterFieldId: string; unit: string
  missingPolicy: "reject" | "explicit_unavailable"
  allowedOps: readonly ("set" | "replace")[]
  evidenceRefs: readonly WorldEvolutionPolicyRef[]
} & (
  { dataType: "number" | "integer"; constraints: Readonly<{ min: number; max: number }> } |
  { dataType: "enum"; constraints: Readonly<{ values: readonly string[] }> } |
  { dataType: "boolean" | "string"; constraints: Readonly<Record<string, never>> }
)>
export type WorldEvolutionHistoryPolicy = Readonly<{
  selectorId: string; selectorVersion: string; maxEvents: number; maxBytes: number
  minimumContextEvents: number; evidenceRefs: readonly WorldEvolutionPolicyRef[]
} & (
  { summaryMode: "none" } |
  { summaryMode: "registered_summary"; summarizerRef: WorldEvolutionPolicyRef; sourceValidationRef: WorldEvolutionPolicyRef }
)>
export type WorldEvolutionMaintenancePolicy = Readonly<
  { mode: "none"; reason: string } |
  { mode: "migration"; compatibleFromVersions: readonly string[]; migrationEvidenceRef: WorldEvolutionPolicyRef; resumeRule: WorldEvolutionPolicyRef }
>
export type WorldEvolutionPolicy = Readonly<{
  schemaVersion: "world-evolution-policy-v1"
  policyId: string; policyVersion: string; scopeId: string; ruleVersion: string
  identity: WorldEvolutionPolicyIdentity
  capabilityRef: WorldEvolutionPolicyRef; modelRef: WorldEvolutionPolicyRef
  validatorRef: WorldEvolutionPolicyRef; inputSchemaRef: WorldEvolutionPolicyRef
  domainFields: readonly WorldEvolutionDomainField[]
  timePolicy: WorldEvolutionTimePolicy; historyPolicy: WorldEvolutionHistoryPolicy
  executionPolicyRef: WorldEvolutionPolicyRef; resourceContractRef: WorldEvolutionPolicyRef
  maintenancePolicy: WorldEvolutionMaintenancePolicy
  registrationEvidenceRefs: readonly WorldEvolutionPolicyRef[]
  contentSha256: string
}>
export type WorldEvolutionPolicyShapeResult = Readonly<{
  policy: WorldEvolutionPolicy; shapeValid: true; shapeOnly: true
  productionAdmitted: false; evidenceVerified: false
}>

const IDENTITIES = ["ownerId", "playerId", "worldId", "worldSeed", "worldProfileId", "regionId"] as const
const FIELDS = ["schemaVersion", "policyId", "policyVersion", "scopeId", "ruleVersion", "identity", "capabilityRef", "modelRef", "validatorRef", "inputSchemaRef", "domainFields", "timePolicy", "historyPolicy", "executionPolicyRef", "resourceContractRef", "maintenancePolicy", "registrationEvidenceRefs"] as const
// Parser allocation limits, not world resource or admissibility defaults.
const MAX_BYTES = 256 * 1024, MAX_NODES = 8192, MAX_DEPTH = 32, MAX_ARRAY = 256
type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
function need(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error("world_evolution_policy_invalid:" + reason)
}

/** Snapshot ordinary JSON without evaluating accessors, toJSON or Proxy traps. */
function snapshot(value: unknown): { value: Json; canonical: string } {
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
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v)
    need(array ? proto === Array.prototype : proto === Object.prototype || proto === null, "prototype")
    const keys = Reflect.ownKeys(v)
    if (array) {
      need(v.length <= MAX_ARRAY && keys.length === v.length + 1 && keys.includes("length"), "array_shape")
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i))
        need(d?.enumerable && Object.hasOwn(d, "value"), "array_accessor_or_hole")
      }
      add("["); const parts: string[] = []
      for (let i = 0; i < v.length; i++) { if (i) add(","); parts.push(walk(Object.getOwnPropertyDescriptor(v, String(i))!.value, depth + 1)) }
      ancestors.delete(v); add("]"); return "[" + parts.join(",") + "]"
    }
    need(keys.length <= MAX_ARRAY, "object_size")
    for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(v, key)!
      need(typeof key === "string" && !["__proto__", "prototype", "constructor"].includes(key) && d.enumerable && Object.hasOwn(d, "value"), "object_accessor_or_key")
    }
    add("{"); const parts: string[] = []
    for (const [i, key] of (keys as string[]).sort().entries()) {
      if (i) add(",")
      need(Buffer.byteLength(key, "utf8") <= MAX_BYTES - bytes, "byte_limit")
      const name = add(JSON.stringify(key)); add(":")
      parts.push(name + ":" + walk(Object.getOwnPropertyDescriptor(v, key)!.value, depth + 1))
    }
    ancestors.delete(v); add("}"); return "{" + parts.join(",") + "}"
  }
  const canonical = walk(value, 0)
  return { value: JSON.parse(canonical) as Json, canonical }
}
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "object")
  need(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), "fields")
}
function text(value: unknown): asserts value is string {
  need(typeof value === "string" && value.trim().length > 0 && value.length <= 1024 && !value.includes("\0"), "text")
}
function immutable(value: unknown): asserts value is string {
  text(value); need(!["latest", "current", "head"].includes(value.toLowerCase()), "mutable_reference")
}
function hash(value: unknown): asserts value is string { need(typeof value === "string" && /^[a-f0-9]{64}$/u.test(value), "sha256") }
function ref(value: unknown): asserts value is WorldEvolutionPolicyRef {
  exact(value, ["id", "version", "sha256"]); immutable(value.id); immutable(value.version); hash(value.sha256)
}
function refs(value: unknown): asserts value is WorldEvolutionPolicyRef[] {
  need(Array.isArray(value) && value.length > 0 && value.length <= 128, "references")
  const seen = new Set<string>()
  for (const v of value) { ref(v); const key = v.id + "\0" + v.version; need(!seen.has(key), "duplicate_reference"); seen.add(key) }
}
function identity(value: unknown): asserts value is WorldEvolutionPolicyIdentity {
  exact(value, IDENTITIES); for (const k of IDENTITIES) text(value[k])
}
function fieldId(value: unknown): asserts value is string {
  text(value); need(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(value) && !value.includes(".."), "field_id")
}
function strings(value: unknown, max = 128): asserts value is string[] {
  need(Array.isArray(value) && value.length > 0 && value.length <= max, "string_set")
  for (const v of value) text(v)
  need(new Set(value).size === value.length, "duplicate_string")
}
function domainField(value: unknown): asserts value is WorldEvolutionDomainField {
  exact(value, ["fieldId", "adapterFieldId", "dataType", "unit", "constraints", "missingPolicy", "allowedOps", "evidenceRefs"])
  fieldId(value.fieldId); fieldId(value.adapterFieldId); text(value.unit)
  need(typeof value.dataType === "string" && ["number", "integer", "boolean", "string", "enum"].includes(value.dataType), "data_type")
  if (value.dataType === "number" || value.dataType === "integer") {
    exact(value.constraints, ["min", "max"])
    const { min, max } = value.constraints
    need(typeof min === "number" && typeof max === "number" && Number.isFinite(min) && Number.isFinite(max) && min <= max, "range")
    if (value.dataType === "integer") need(Number.isSafeInteger(min) && Number.isSafeInteger(max), "integer_range")
  } else if (value.dataType === "enum") { exact(value.constraints, ["values"]); strings(value.constraints.values); need(value.unit === "dimensionless", "dimensionless_unit") }
  else { exact(value.constraints, []); need(value.unit === "dimensionless", "dimensionless_unit") }
  need(value.missingPolicy === "reject" || value.missingPolicy === "explicit_unavailable", "missing_policy")
  strings(value.allowedOps, 2); need(value.allowedOps.every(op => op === "set" || op === "replace"), "operation")
  refs(value.evidenceRefs)
}
function history(value: unknown): asserts value is WorldEvolutionHistoryPolicy {
  need(value !== null && typeof value === "object", "history")
  const mode = (value as Record<string, unknown>).summaryMode
  // Parser-v1 representation of ARCH4.4.2: named summary refs, not new qualifications.
  const common = ["selectorId", "selectorVersion", "maxEvents", "maxBytes", "minimumContextEvents", "summaryMode", "evidenceRefs"]
  need(mode === "none" || mode === "registered_summary", "summary_mode")
  exact(value, mode === "none" ? common : [...common, "summarizerRef", "sourceValidationRef"])
  immutable(value.selectorId); immutable(value.selectorVersion)
  need(Number.isSafeInteger(value.maxEvents) && (value.maxEvents as number) > 0 && Number.isSafeInteger(value.maxBytes) && (value.maxBytes as number) > 0, "history_budget")
  need(Number.isSafeInteger(value.minimumContextEvents) && (value.minimumContextEvents as number) >= 0 && (value.minimumContextEvents as number) <= (value.maxEvents as number), "history_minimum")
  refs(value.evidenceRefs)
  if (mode === "registered_summary") { ref(value.summarizerRef); ref(value.sourceValidationRef) }
}
function maintenance(value: unknown): asserts value is WorldEvolutionMaintenancePolicy {
  need(value !== null && typeof value === "object", "maintenance")
  const mode = (value as Record<string, unknown>).mode
  // Parser-v1 maps the otherwise abstract resumeRule to an immutable rule ref.
  if (mode === "none") { exact(value, ["mode", "reason"]); text(value.reason) }
  else {
    need(mode === "migration", "maintenance_mode")
    exact(value, ["mode", "compatibleFromVersions", "migrationEvidenceRef", "resumeRule"])
    strings(value.compatibleFromVersions); value.compatibleFromVersions.forEach(immutable)
    ref(value.migrationEvidenceRef); ref(value.resumeRule)
  }
}
function parseContent(value: unknown, expectedIdentity?: unknown): Record<string, unknown> {
  exact(value, FIELDS); need(value.schemaVersion === "world-evolution-policy-v1", "schema")
  text(value.policyId); immutable(value.policyVersion); text(value.scopeId); immutable(value.ruleVersion)
  identity(value.identity); const policyIdentity = value.identity
  if (expectedIdentity !== undefined) { const expected = snapshot(expectedIdentity).value; identity(expected); need(IDENTITIES.every(k => expected[k] === policyIdentity[k]), "identity_mismatch") }
  for (const key of ["capabilityRef", "modelRef", "validatorRef", "inputSchemaRef", "executionPolicyRef", "resourceContractRef"]) ref(value[key])
  need(Array.isArray(value.domainFields) && value.domainFields.length > 0 && value.domainFields.length <= 64, "domain_fields")
  value.domainFields.forEach(domainField)
  need(new Set(value.domainFields.map(f => (f as WorldEvolutionDomainField).fieldId)).size === value.domainFields.length, "duplicate_field")
  validateWorldEvolutionTimePolicy(value.timePolicy)
  history(value.historyPolicy); maintenance(value.maintenancePolicy); refs(value.registrationEvidenceRefs)
  return value
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }
  return value
}

/** Validates the content shape, excludes contentSha256, then hashes sorted-key JSON. */
export function computeWorldEvolutionPolicySha(valueWithoutSha: unknown): string {
  const fixed = snapshot(valueWithoutSha); parseContent(fixed.value)
  return createHash("sha256").update(fixed.canonical, "utf8").digest("hex")
}
export function validateWorldEvolutionPolicy(value: unknown, expectedIdentity?: unknown): WorldEvolutionPolicyShapeResult {
  const fixed = snapshot(value).value; exact(fixed, [...FIELDS, "contentSha256"]); hash(fixed.contentSha256)
  const content = Object.fromEntries(Object.entries(fixed).filter(([key]) => key !== "contentSha256"))
  parseContent(content, expectedIdentity)
  need(computeWorldEvolutionPolicySha(content) === fixed.contentSha256, "content_sha256")
  return freeze({ policy: fixed as unknown as WorldEvolutionPolicy, shapeValid: true as const, shapeOnly: true as const, productionAdmitted: false as const, evidenceVerified: false as const })
}

/** Adapter identifiers only. No default min/max, allowed region or model qualification. */
export const FIXED_ENVIRONMENT_FIELD_DESCRIPTORS = freeze([
  { fieldId: "environment.PRECTOTCORR", adapterFieldId: "environment.PRECTOTCORR", dataType: "number", unit: "mm/day" },
  { fieldId: "environment.RH2M", adapterFieldId: "environment.RH2M", dataType: "number", unit: "%" },
  { fieldId: "environment.T2M", adapterFieldId: "environment.T2M", dataType: "number", unit: "C" },
  { fieldId: "environment.WS2M", adapterFieldId: "environment.WS2M", dataType: "number", unit: "m/s" },
] as const)
export function validateFixedEnvironmentPolicyFields(value: unknown): Readonly<{ fields: readonly WorldEvolutionDomainField[]; shapeOnly: true; productionAdmitted: false }> {
  const fixed = snapshot(value).value
  need(Array.isArray(fixed) && fixed.length > 0 && fixed.length <= 4, "fixed_environment_fields")
  fixed.forEach(domainField)
  need(new Set(fixed.map(f => (f as unknown as WorldEvolutionDomainField).fieldId)).size === fixed.length, "duplicate_field")
  for (const value of fixed) {
    const field = value as unknown as WorldEvolutionDomainField, descriptor = FIXED_ENVIRONMENT_FIELD_DESCRIPTORS.find(d => d.fieldId === field.fieldId)
    need(descriptor && descriptor.adapterFieldId === field.adapterFieldId && descriptor.dataType === field.dataType && descriptor.unit === field.unit, "fixed_environment_descriptor")
  }
  return freeze({ fields: fixed as unknown as WorldEvolutionDomainField[], shapeOnly: true as const, productionAdmitted: false as const })
}
