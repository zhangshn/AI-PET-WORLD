// Synthetic codec fixtures do not attest training, image semantics or GPU execution.
import assert from "node:assert/strict"
import { after, test } from "node:test"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { decodeV17CandidateManifest, validateV17CandidateManifest }
  from "../lib/ai-painter-stage4-mvp-v17-candidate-manifest.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v17-manifest-"))
after(() => {
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()))
  assert.ok(path.basename(temp).startsWith("v17-manifest-"))
  fs.rmSync(temp, { recursive: true, force: false })
})
const python = process.env.V17_CODEC_TEST_PYTHON || path.join(root, "ml/ai-painter/.venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
execFileSync(python, ["-B", path.join(root, "ml/ai-painter/tests/test_stage4_v17_candidate_manifest.py"),
  "--emit-fixture", temp,
  path.join(root, "data/ai-painter/system-governance/stage4-mvp-structured-object-v17-review-pack-schema-v1.json")],
{ cwd: root, timeout: 120000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1",
  CUDA_VISIBLE_DEVICES: "", OMP_NUM_THREADS: "2", MKL_NUM_THREADS: "2" } })
const { sourceBase64, ...context } = JSON.parse(fs.readFileSync(path.join(temp, "bindings.json"), "utf8"))
const sourceBytes = Object.fromEntries(Object.entries(sourceBase64).map(([key, value]) => [key, Buffer.from(value, "base64")]))
const schemaBytes = fs.readFileSync(path.join(temp, "interface.json"))
const manifestBytes = fs.readFileSync(path.join(temp, "manifest.json"))
const manifest = JSON.parse(manifestBytes)
const options = { ...context, sourceBytes, schemaBytes }
const decode = (overrides = {}) => decodeV17CandidateManifest({ ...options, manifestBytes, ...overrides })
const validate = (changed, overrides = {}) => validateV17CandidateManifest({ ...options, manifest: changed, ...overrides })

test("Node directly consumes actual Python manifest bytes and preserves caller inputs", () => {
  const before = JSON.stringify(context.trustedContext)
  const result = decode()
  assert.deepEqual(result, manifest)
  assert.deepEqual(result.candidates.map(row => row.sampleIndex), [0, 1, 2, 3, 4, 5, 6, 7])
  result.candidates[0].candidateRgb.width = 1
  assert.equal(manifest.candidates[0].candidateRgb.width, 256)
  assert.equal(JSON.stringify(context.trustedContext), before)
})

test("schema hash, manifest version, and independently supplied context are mandatory", () => {
  assert.throws(() => decode({ schemaSha256: "0".repeat(64) }), /interface SHA/)
  assert.throws(() => decode({ candidatePackSchemaVersion: "old-v16" }), /pack schema/)
  assert.throws(() => validate({ ...manifest, schemaVersion: "old-v16" }), /pack schema/)
  assert.throws(() => decode({ trustedContext: {} }), /trusted context/)
})

test("every trusted top-level run/package/terminal/checkpoint/model binding is enforced", () => {
  for (const key of Object.keys(context.trustedContext)) {
    if (key === "orderedValidationRows") continue
    const trustedContext = structuredClone(context.trustedContext)
    const value = trustedContext[key]
    trustedContext[key] = typeof value === "object" ? (value.sha256
      ? { ...value, sha256: "f".repeat(64) } : { other: true })
      : typeof value === "number" ? value + 1 : key.endsWith("Sha256") ? "f".repeat(64) : "other"
    assert.throws(() => decode({ trustedContext }), /identity equation/, key)
  }
})

test("all seven responsibility identity equations are enforced", () => {
  for (const key of ["worldId", "regionId", "tick", "factHash", "visualFactManifestSha256",
    "conditionPackSha256", "modelStateSha256"]) {
    const changed = structuredClone(manifest)
    changed.candidates[0].responsibilityEvidence[key] = key === "tick" ? 99 : "f".repeat(64)
    assert.throws(() => validate(changed), /identity equation/, key)
  }
})

test("eight validation candidates require exact order, unique IDs, split and dimensions", () => {
  assert.throws(() => validate({ ...manifest, candidates: manifest.candidates.slice(1) }), /count/)
  for (const [key, value] of [["sampleIndex", 1], ["sampleId", "synthetic-sample-1"], ["split", "train"]]) {
    const changed = structuredClone(manifest)
    changed.candidates[0][key] = value
    assert.throws(() => validate(changed), undefined, key)
  }
  const swapped = structuredClone(manifest)
  swapped.candidates.reverse()
  assert.throws(() => validate(swapped), /order/)
  const duplicate = structuredClone(manifest)
  const trustedContext = structuredClone(context.trustedContext)
  duplicate.candidates[1].sampleId = duplicate.candidates[0].sampleId
  trustedContext.orderedValidationRows[1].sampleId = duplicate.candidates[0].sampleId
  assert.throws(() => validate(duplicate, { trustedContext }), /unique/)
  const dimensions = structuredClone(manifest)
  dimensions.candidates[0].candidateRgb.width = 255
  dimensions.candidates[0].artifactIdentity.candidateRgb.width = 255
  const trustedDimensions = structuredClone(context.trustedContext)
  trustedDimensions.orderedValidationRows[0].candidateRgb.width = 255
  assert.throws(() => validate(dimensions, { trustedContext: trustedDimensions }), /RGB width/)
})

test("every source binding category recomputes supplied file byte SHA", () => {
  const paths = ["executionPackage", "trainingTerminal", "datasetManifest", "checkpoint", "inferenceReport"]
    .map(key => manifest[key].path)
  const candidate = manifest.candidates[0]
  paths.push(...["candidateRgb", "referenceRgb", "conditionPack"].map(key => candidate[key].path),
    ...candidate.objectMasks.map(item => item.path), candidate.responsibilityEvidence.tensorArchive.path)
  for (const key of paths) assert.throws(() => decode({ sourceBytes: { ...sourceBytes, [key]: Buffer.from("tampered") } }), /source byte SHA/, key)
  const missing = { ...sourceBytes }
  delete missing[paths[0]]
  assert.throws(() => decode({ sourceBytes: missing }), /source bytes missing/)
})

test("extra tensor roles, missing hashes, reversed mask order and extra masks fail closed", () => {
  for (const extra of [true, false]) {
    const changed = structuredClone(manifest)
    const hashes = changed.candidates[0].responsibilityEvidence.roleSha256
    if (extra) hashes.extra = "0".repeat(64)
    else delete hashes.object_tree
    assert.throws(() => validate(changed), /role SHA/)
  }
  for (const extra of [true, false]) {
    const changed = structuredClone(manifest)
    const trustedContext = structuredClone(context.trustedContext)
    if (extra) changed.candidates[0].objectMasks.push({ ...changed.candidates[0].objectMasks[0] })
    else changed.candidates[0].objectMasks.reverse()
    trustedContext.orderedValidationRows[0].objectMasks = structuredClone(changed.candidates[0].objectMasks)
    assert.throws(() => validate(changed, { trustedContext }), /mask/)
  }
})

test("boundary, inference mode, precision, UTC date and required fields are enforced", () => {
  assert.throws(() => validate({ ...manifest, executionBoundary: { ...manifest.executionBoundary, qualificationGranted: true } }), /boundary/)
  assert.throws(() => validate({ ...manifest, executionBoundary: { ...manifest.executionBoundary, optimizerSteps: false } }), /boundary/)
  assert.throws(() => validate({ ...manifest, recordedAtUtc: "2026-02-30T00:00:00Z" }), /UTC/)
  for (const [key, value] of [["inferenceMode", "old-v16"], ["precisionExecutionPlan", {}]]) {
    const changed = structuredClone(manifest)
    changed.candidates[0].artifactIdentity[key] = value
    assert.throws(() => validate(changed), undefined, key)
  }
  const missing = structuredClone(manifest)
  delete missing.inferenceReport
  assert.throws(() => validate(missing), /fields missing/)
})
