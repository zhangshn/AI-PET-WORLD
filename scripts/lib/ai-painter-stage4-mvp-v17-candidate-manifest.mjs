// Pure manifest consumer. Trusted context must come from independent caller checks.
// Byte binding is verified here; image/condition semantics and real execution proof
// remain the materializer/reviewer's responsibility. No filesystem IO or eligibility.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { loadV17ResponsibilityInterface, decodeV17ResponsibilityArtifact }
  from "./ai-painter-stage4-mvp-v17-responsibility-artifact.mjs"

const object = value => value !== null && typeof value === "object" && !Array.isArray(value)
function fields(value, names, label, exact = false) {
  assert.ok(object(value) && names.every(key => Object.hasOwn(value, key)), `${label} fields missing`)
  if (exact) assert.deepEqual(Object.keys(value).sort(), [...names].sort(), `${label} extra fields`)
}
function json(value) {
  if (value === null || ["string", "boolean"].includes(typeof value)) return
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), "nonfinite JSON number")
    assert.ok(!Number.isInteger(value) || Number.isSafeInteger(value), "unsafe JSON integer")
    return
  }
  if (Array.isArray(value)) { value.forEach(json); return }
  assert.ok(object(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)), "non-JSON value")
  Object.values(value).forEach(json)
}
function equal(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]))
  if (object(a) && object(b)) return Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every(key => Object.hasOwn(b, key) && equal(a[key], b[key]))
  return false
}
function digest(value) {
  assert.ok(typeof value === "string" && /^[a-f0-9]{64}$/u.test(value), "invalid SHA-256")
}
function binding(value, sourceBytes, names = ["path", "sha256"], exact = true) {
  fields(value, names, "source binding", exact)
  assert.ok(typeof value.path === "string" && value.path && !/[\\:\x00-\x1f]/u.test(value.path)
    && value.path.split("/").every(part => !["", ".", "..", "latest", "latest.json"].includes(part)),
  "invalid project-relative source path")
  digest(value.sha256)
  assert.ok(Object.hasOwn(sourceBytes, value.path) && Buffer.isBuffer(sourceBytes[value.path]),
    `source bytes missing: ${value.path}`)
  const bytes = sourceBytes[value.path]
  assert.equal(createHash("sha256").update(bytes).digest("hex"), value.sha256,
    `source byte SHA mismatch: ${value.path}`)
  return bytes
}
function resolve(reference, scope, ordinal) {
  if (reference === "zero_based_validation_ordinal") return ordinal
  assert.match(reference, /^(?:manifest|trusted|candidate)(?:\.[A-Za-z][A-Za-z0-9]*(?:\[ordinal\])?)+$/u,
    "unsupported identity equation reference")
  const [root, ...parts] = reference.split(".")
  let value = scope[root]
  for (const part of parts) {
    const indexed = part.endsWith("[ordinal]")
    const key = indexed ? part.slice(0, -9) : part
    assert.ok(object(value) && Object.hasOwn(value, key), "identity equation source missing")
    value = value[key]
    if (indexed) {
      assert.ok(Array.isArray(value) && ordinal < value.length, "identity equation row missing")
      value = value[ordinal]
    }
  }
  return value
}
function masks(value, spec, sourceBytes) {
  assert.equal(spec.container, "array")
  assert.equal(spec.orderRule, "exactly_the_roles_array_order_one_entry_per_role_no_extra_entries")
  assert.ok(Array.isArray(value) && value.length === spec.roles.length, "mask count differs")
  value.forEach((item, i) => {
    binding(item, sourceBytes, spec.itemFields)
    assert.equal(item.role, spec.roles[i], "mask role order differs")
  })
}

export function validateV17CandidateManifest({ manifest, trustedContext, sourceBytes,
  schemaBytes, schemaSha256, candidatePackSchemaVersion }) {
  const schema = loadV17ResponsibilityInterface({ schemaBytes, schemaSha256, candidatePackSchemaVersion })
  assert.deepEqual(schema.bindingShape.requiredFields, ["path", "sha256"])
  assert.equal(schema.bindingShape.additionalFieldsAllowed, false)
  json(manifest)
  json(trustedContext)
  fields(manifest, schema.requiredManifestFields, "manifest")
  fields(trustedContext, schema.requiredTrustedContextFields, "trusted context")
  assert.ok(object(sourceBytes), "source byte map required")
  assert.equal(manifest.schemaVersion, schema.candidatePackSchemaVersion, "candidate pack schema mismatch")
  for (const key of ["status", "capabilityVersion", "modelArchitectureId", "stage", "candidateCount", "candidateSplit"])
    assert.ok(equal(manifest[key], schema[key]), `${key} differs from interface`)
  assert.ok(equal(manifest.executionBoundary, schema.requiredExecutionBoundary), "execution boundary differs")
  for (const key of ["runId", "packageId"])
    assert.ok(typeof trustedContext[key] === "string" && trustedContext[key].trim(), `invalid trusted ${key}`)
  for (const key of ["modelStateSha256", "discriminatorStateSha256"]) digest(trustedContext[key])
  const timestamp = manifest.recordedAtUtc
  assert.ok(typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(timestamp)
    && Number(timestamp.slice(0, 4)) > 0 && Number.isFinite(Date.parse(timestamp)), "invalid UTC timestamp")
  assert.equal(new Date(timestamp).toISOString().slice(0, 19), timestamp.slice(0, 19), "invalid UTC date")
  const rows = trustedContext.orderedValidationRows
  assert.ok(Array.isArray(rows) && Array.isArray(manifest.candidates)
    && rows.length === schema.candidateCount && manifest.candidates.length === rows.length, "candidate count differs")
  for (const key of ["executionPackage", "trainingTerminal", "datasetManifest", "checkpoint", "inferenceReport"])
    binding(manifest[key], sourceBytes)
  const seen = new Set()
  manifest.candidates.forEach((candidate, ordinal) => {
    const row = rows[ordinal]
    fields(row, schema.orderedValidationRowFields, "trusted validation row")
    fields(candidate, schema.requiredCandidateFields, "candidate")
    assert.ok(typeof candidate.sampleId === "string" && candidate.sampleId.trim()
      && !seen.has(candidate.sampleId), "sampleId must be nonempty and unique")
    seen.add(candidate.sampleId)
    assert.ok(Number.isSafeInteger(candidate.sampleIndex) && candidate.sampleIndex === ordinal, "sampleIndex order differs")
    assert.equal(candidate.split, schema.candidateSplit, "candidate split differs")
    fields(candidate.artifactIdentity, schema.requiredArtifactIdentityFields, "artifact identity")
    assert.equal(candidate.artifactIdentity.inferenceMode, schema.inferenceMode, "inference mode differs")
    assert.ok(equal(candidate.artifactIdentity.precisionExecutionPlan, manifest.precisionExecutionPlan), "artifact precision plan differs")
    const scope = { manifest, trusted: trustedContext, candidate }
    for (const equation of schema.identityEquations) {
      const sides = equation.split("==")
      assert.equal(sides.length, 2, "unsupported identity equation")
      assert.ok(equal(resolve(sides[0], scope, ordinal), resolve(sides[1], scope, ordinal)), `identity equation mismatch: ${equation}`)
    }
    for (const key of ["candidateRgb", "referenceRgb", "conditionPack"])
      binding(candidate[key], sourceBytes, schema.candidateArtifacts[key].requiredFields, key !== "candidateRgb")
    for (const key of ["role", "width", "height"])
      assert.ok(equal(candidate.candidateRgb[key], schema.candidateArtifacts.candidateRgb[key]), `candidate RGB ${key} differs`)
    masks(candidate.objectMasks, schema.candidateArtifacts.objectMasks, sourceBytes)
    const evidence = candidate.responsibilityEvidence
    fields(evidence, schema.responsibilityEvidence.requiredFields, "responsibility evidence")
    const archiveBytes = binding(evidence.tensorArchive, sourceBytes)
    const expectedIdentity = Object.fromEntries(["worldId", "regionId", "tick", "factHash", "visualFactManifestSha256"]
      .map(key => [key, row[key]]))
    expectedIdentity.conditionPackSha256 = row.conditionPack.sha256
    expectedIdentity.modelStateSha256 = trustedContext.modelStateSha256
    decodeV17ResponsibilityArtifact({ archiveBytes, evidence, expectedIdentity,
      schemaBytes, schemaSha256, candidatePackSchemaVersion })
  })
  return structuredClone(manifest)
}

export function decodeV17CandidateManifest({ manifestBytes, ...bindings }) {
  assert.ok(Buffer.isBuffer(manifestBytes), "manifest bytes required")
  return validateV17CandidateManifest({ ...bindings, manifest: JSON.parse(manifestBytes.toString("utf8")) })
}
