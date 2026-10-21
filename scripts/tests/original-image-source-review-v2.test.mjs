import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import test from "node:test"
import { fixture, runIntake } from "./helpers/original-image-source-fixture.mjs"

// Explicit local integration: the immutable style fingerprint is a local
// calibration asset, not a clean-checkout fixture. These tests are not added
// to repository-only CI and do not certify full source or model qualification.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex")
const parse = (f, file) => JSON.parse(fs.readFileSync(path.join(f.root, file)))
const PROGRAMS = ["scripts/lib/ai-painter-source-correction-review-v1.mjs", "scripts/lib/ai-painter-source-correction-intake-v1.mjs",
  "scripts/lib/complete-map-world-frame-integrity.mjs", "scripts/review-ai-assisted-cold-start-image.mjs",
  "scripts/run-ai-assisted-cold-start-review-pipeline.mjs", "scripts/lib/ai-assisted-condition-alignment.mjs",
  "scripts/lib/ai-assisted-style-fingerprint.mjs",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md"]

async function reviewFixture(t) {
  const f = await fixture(t)
  const pack = parse(f, f.pack.path)
  pack.canvas = { width: 1024, height: 768 }
  pack.conditionPackId = "conditions-0"
  const packBinding = f.put(f.pack.path, pack)
  for (const row of f.rows) row.conditionPack = packBinding
  const sourceIndex = f.put("data/source-index.json", { sampleCount: 64, samples: f.rows })
  const manifest = parse(f, f.parentDataset.path)
  manifest.sourceIndex = sourceIndex
  f.request.sourceCorrection.parentDataset = f.put(f.parentDataset.path, manifest)
  f.request.sourceCorrection.conditionPack = packBinding
  for (const file of PROGRAMS) f.put(file, fs.readFileSync(path.join(REPO, file)))
  const thresholdPath = "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json"
  const threshold = JSON.parse(fs.readFileSync(path.join(REPO, thresholdPath)))
  f.put(thresholdPath, fs.readFileSync(path.join(REPO, thresholdPath)))
  f.put(threshold.styleFingerprint.path, fs.readFileSync(path.join(REPO, threshold.styleFingerprint.path)))
  // Deliberately false caller claims must not become source qualification.
  f.request.trainingEligible = true
  f.request.sourceSemanticQualified = true
  f.request.sourceLicenseQualified = true
  const intake = runIntake(f)
  assert.equal(intake.status, 0, intake.stderr)
  const recordPath = JSON.parse(intake.stdout).recordPath
  const sourceRecord = fs.readFileSync(path.join(f.root, recordPath))
  const originalIndex = fs.readFileSync(path.join(f.root, f.library, "index.json"))
  return { ...f, recordPath, sourceRecord, originalIndex, thresholdPath }
}

function runReview(f, pipeline = false, extraArgs = []) {
  return spawnSync(process.execPath, [path.join(REPO, pipeline
    ? "scripts/run-ai-assisted-cold-start-review-pipeline.mjs" : "scripts/review-ai-assisted-cold-start-image.mjs"),
  "--record-id", f.request.recordId, ...extraArgs], { cwd: f.root, encoding: "utf8", timeout: 25000,
    env: { ...process.env, AI_PET_WORLD_DATA_ROOT: path.join(f.root, ".private-storage") } })
}

function assertOriginalsUnchanged(f) {
  assert(f.sourceRecord.equals(fs.readFileSync(path.join(f.root, f.recordPath))))
  assert(f.originalIndex.equals(fs.readFileSync(path.join(f.root, f.library, "index.json"))))
}

for (const pipeline of [false, true]) test(`current ${pipeline ? "pipeline" : "review"} entry reports retained checks without deleted audit gates`, async t => {
  const f = await reviewFixture(t)
  const response = runReview(f, pipeline)
  const report = JSON.parse(response.stdout)
  assert.equal(response.status, report.passed ? 0 : 1, response.stderr)
  assert.equal(report.passed, report.scores.existingComponentsPassed)
  assert.equal(report.status, report.passed ? "review_passed" : "review_failed")
  assert.equal(Object.hasOwn(report, "sourceSemanticQualified"), false)
  assert.equal(Object.hasOwn(report, "sourceLicenseQualified"), false)
  assert.equal(Object.hasOwn(report, "sourceEvidenceAudit"), false)
  assert.equal(Object.hasOwn(report, "projectSourceUseAllowed"), false)
  assert.equal(Object.hasOwn(report, "projectSourceUseDecision"), false)
  assert.equal(Object.hasOwn(report.identityPayload, "projectSourceUsePolicy"), false)
  assert.equal(report.trainingEligible, false)
  assert.equal(report.aiAssistedColdStartEligible, report.passed)
  assert.equal(report.independentTrainingEligible, false)
  assert.equal(report.manualVisualInspectionPerformed, false)
  assert.equal(report.thresholds.unchanged, true)
  assert(!JSON.stringify(report).includes("waiting_owner"))
  assert(!report.issues.some(item => item.code === "evidence_ambiguous"))
  assert.deepEqual(report.issues, [...report.styleFingerprintAudit.issues,
    ...report.semanticConditionAudit.issues, ...report.worldFrameIntegrityAudit.issues])
  assert(!report.identityPayload.programBindings.some(item => item.path.includes("source-correction-evidence")))
  assertOriginalsUnchanged(f)
  assert.equal(sha(fs.readFileSync(path.join(f.root, report.reviewPath))), report.reviewSha256)
  const events = fs.readFileSync(path.join(f.root, ".runtime/ai-painter/training-process-ledger/events.jsonl"), "utf8")
    .trim().split("\n").map(line => JSON.parse(line))
  assert.equal(events.length, 1)
  assert.equal(events[0].id, report.ledgerEventId)
  assert.equal(events[0].status, report.passed ? "info" : "failed")
  assert.equal(fs.existsSync(path.join(f.root, ".runtime/ai-painter/style-fingerprints/latest.json")), false)
  assert.equal(fs.existsSync(path.join(f.root, ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/latest.json")), false)
})

test("a repeated current review cannot overwrite immutable evidence or append another event", async t => {
  const f = await reviewFixture(t)
  const first = runReview(f)
  const report = JSON.parse(first.stdout)
  const saved = fs.readFileSync(path.join(f.root, report.reviewPath))
  const ledger = fs.readFileSync(path.join(f.root, ".runtime/ai-painter/training-process-ledger/events.jsonl"))
  const repeat = runReview(f)
  assert.equal(repeat.status, 1)
  assert(repeat.stderr.includes("EEXIST"), repeat.stderr)
  assert(saved.equals(fs.readFileSync(path.join(f.root, report.reviewPath))))
  assert(ledger.equals(fs.readFileSync(path.join(f.root, ".runtime/ai-painter/training-process-ledger/events.jsonl"))))
  assertOriginalsUnchanged(f)
})

test("unindexed current source and changed archived request fail before review output", async t => {
  for (const mutate of [
    f => { f.put(f.library + "/index.json", { records: [] }) },
    f => { fs.appendFileSync(path.join(f.root, parse(f, f.recordPath).sourceCorrection.intakeRequest.path), " ") },
  ]) {
    const f = await reviewFixture(t)
    mutate(f)
    const response = runReview(f)
    assert.equal(response.status, 1)
    assert.equal(response.stdout.trim(), "")
    assert.equal(fs.existsSync(path.join(f.root, path.dirname(f.recordPath), "reviews")), false)
    assert.equal(fs.existsSync(path.join(f.root, ".runtime/ai-painter/training-process-ledger/events.jsonl")), false)
  }
})

test("changed source pixels and forged qualification reject before any component grant", async t => {
  for (const mutate of [
    f => { fs.appendFileSync(path.join(f.root, parse(f, f.recordPath).relativeDirectory, "source/original.png"), "changed") },
    f => { const row = parse(f, f.recordPath); row.aiAssistedColdStartEligible = true; f.put(f.recordPath, row) },
  ]) {
    const f = await reviewFixture(t)
    mutate(f)
    const response = runReview(f)
    assert.equal(response.status, 1)
    assert.equal(response.stdout.trim(), "")
    assert.equal(fs.existsSync(path.join(f.root, path.dirname(f.recordPath), "reviews")), false)
  }
})

test("frozen threshold or style fingerprint changes are not repaired by a latest pointer", async t => {
  for (const kind of ["threshold", "fingerprint"]) {
    const f = await reviewFixture(t)
    const threshold = parse(f, f.thresholdPath)
    const target = kind === "threshold" ? f.thresholdPath : threshold.styleFingerprint.path
    fs.appendFileSync(path.join(f.root, target), " ")
    f.put(".runtime/ai-painter/style-fingerprints/latest.json", { fingerprintPath: threshold.styleFingerprint.path })
    const response = runReview(f)
    assert.equal(response.status, 1)
    assert(response.stderr.includes("SHA mismatch"), response.stderr)
    assert.equal(response.stdout.trim(), "")
  }
})

test("a review-directory junction cannot redirect new evidence outside its source record", async t => {
  const f = await reviewFixture(t)
  const outside = path.join(f.root, "unrelated-output")
  fs.mkdirSync(outside)
  fs.symlinkSync(outside, path.join(f.root, path.dirname(f.recordPath), "reviews"), "junction")
  const response = runReview(f)
  assert.equal(response.status, 1)
  assert(response.stderr.includes("review output escaped"), response.stderr)
  assert.deepEqual(fs.readdirSync(outside), [])
  assertOriginalsUnchanged(f)
})

test("same-image re-review binds its explicit parent without inheriting qualification", async t => {
  const f = await reviewFixture(t)
  const first = JSON.parse(runReview(f).stdout)
  const response = runReview(f, true, ["--parent-review", first.reviewPath, "--parent-review-sha256", first.reviewSha256])
  assert.equal(response.status, 1, response.stderr)
  const second = JSON.parse(response.stdout)
  assert.equal(second.parentReviewId, first.reviewId)
  assert.notEqual(second.reviewId, first.reviewId)
  assert.equal(Object.hasOwn(second, "sourceSemanticQualified"), false)
  assert.equal(Object.hasOwn(second, "sourceLicenseQualified"), false)
  assertOriginalsUnchanged(f)
  const saved = fs.readFileSync(path.join(f.root, second.reviewPath))
  const repeated = runReview(f, true, ["--parent-review", first.reviewPath, "--parent-review-sha256", first.reviewSha256])
  assert.equal(repeated.status, 1)
  assert(repeated.stderr.includes("EEXIST"), repeated.stderr)
  assert(saved.equals(fs.readFileSync(path.join(f.root, second.reviewPath))))
})

test("incomplete, foreign-image or tampered parent bindings do not create a new review", async t => {
  for (const mode of ["missing_sha", "other_source", "other_rgb", "wrong_sha"]) {
    const f = await reviewFixture(t)
    const parentPath = path.dirname(f.recordPath) + "/reviews/machine/parent.json"
    const row = parse(f, f.recordPath)
    const parent = f.put(parentPath, { reviewId: "parent-review", recordId: f.request.recordId,
      inputImageSha256: mode === "other_rgb" ? "a".repeat(64) : row.originalImage.sha256 })
    const args = mode === "missing_sha" ? ["--parent-review", parentPath]
      : ["--parent-review", mode === "other_source" ? "data/foreign-review.json" : parent.path,
        "--parent-review-sha256", mode === "wrong_sha" ? "b".repeat(64) : parent.sha256]
    const response = runReview(f, false, args)
    assert.equal(response.status, 1)
    assert.equal(response.stdout.trim(), "")
    assert.deepEqual(fs.readdirSync(path.join(f.root, path.dirname(parentPath))), ["parent.json"])
    assert.equal(fs.existsSync(path.join(f.root, ".runtime/ai-painter/training-process-ledger/events.jsonl")), false)
    assertOriginalsUnchanged(f)
  }
})
