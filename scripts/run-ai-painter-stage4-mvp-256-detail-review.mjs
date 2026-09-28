import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"

const ROOT = process.cwd()
const CONTRACT_PATH = "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json"
const V10_CAPABILITY = "stage4_mvp_native_complete_rgb_aperiodic_detail_renderer_v10"
const V11_CAPABILITY = "stage4_mvp_native_complete_rgb_object_context_renderer_v11"
const V12_CAPABILITY = "stage4_mvp_native_complete_rgb_local_texture_renderer_v12"
const V9_CAPABILITY = "stage4_mvp_native_complete_rgb_detail_recovery_renderer_v9"
const args = parseArgs(process.argv.slice(2))
const manifestBinding = {
  path: required(args, "candidate-manifest").replaceAll("\\", "/"),
  sha256: required(args, "candidate-manifest-sha256"),
}
const outputPath = inside(required(args, "output").replaceAll("\\", "/"))
assert.equal(fs.existsSync(outputPath), false, "detail review output already exists")

const contractBinding = bind(CONTRACT_PATH)
const contract = readBoundJson(contractBinding, "detailContract")
const manifest = readBoundJson(manifestBinding, "candidateManifest")
assert.equal(manifest.schemaVersion, "ai-painter-stage4-mvp-stage0-review-candidate-pack-v1")
assert.equal(manifest.status, "candidate_pack_materialized_review_pending")
assert.deepEqual(manifest.stage, { stage: 0, width: 256, height: 192,
  epochCount: (manifest.architectureId === V9_CAPABILITY || manifest.architectureId === V10_CAPABILITY || manifest.architectureId === V11_CAPABILITY || manifest.architectureId === V12_CAPABILITY) ? 24 : 40 })
assert.equal(manifest.candidateSplit, "validation")
assert.equal(manifest.candidateCount, 8)

const reviews = []
for (const candidate of manifest.candidates) {
  verifyBinding(candidate.candidateRgb, `candidate_${candidate.sampleIndex}`)
  verifyBinding(candidate.referenceRgb, `reference_${candidate.sampleIndex}`)
  const audit = await auditMvp256DetailSufficiency({
    candidatePath: inside(candidate.candidateRgb.path),
    referencePath: inside(candidate.referenceRgb.path),
    contract,
  })
  reviews.push({
    sampleIndex: candidate.sampleIndex,
    sampleId: candidate.sampleId,
    candidateRgb: candidate.candidateRgb,
    referenceRgb: candidate.referenceRgb,
    ...audit,
  })
  verifyBinding(candidate.candidateRgb, `candidate_${candidate.sampleIndex}_after_review`)
  verifyBinding(candidate.referenceRgb, `reference_${candidate.sampleIndex}_after_review`)
}
const passCount = reviews.filter((review) => review.passed).length
const report = {
  schemaVersion: "stage4-mvp-256-detail-sufficiency-review-v1",
  status: passCount === reviews.length
    ? "stage4_mvp_256_detail_sufficiency_review_passed"
    : "stage4_mvp_256_detail_sufficiency_review_failed",
  executionState: "completed",
  runId: manifest.runId,
  architectureId: manifest.architectureId,
  stage: manifest.stage,
  candidateManifest: manifestBinding,
  contract: contractBinding,
  candidateCount: reviews.length,
  candidatePassCount: passCount,
  candidateFailCount: reviews.length - passCount,
  issueHistogram: {
    [contract.failureCode]: reviews.length - passCount,
  },
  reviews,
  boundary: contract.boundary,
  recordedAtUtc: new Date().toISOString(),
}
writeExclusiveJson(outputPath, report)
process.stdout.write(`${JSON.stringify({
  status: report.status,
  candidatePassCount: report.candidatePassCount,
  candidateFailCount: report.candidateFailCount,
  ratios: reviews.map((review) => ({ sampleIndex: review.sampleIndex, ratios: review.ratios })),
  report: bind(projectPath(outputPath)),
}, null, 2)}\n`)

function parseArgs(values) {
  const parsed = new Map()
  for (let index = 0; index < values.length; index += 2) {
    assert.ok(values[index]?.startsWith("--"), "invalid argument")
    assert.ok(values[index + 1] && !values[index + 1].startsWith("--"), `missing value for ${values[index]}`)
    parsed.set(values[index].slice(2), values[index + 1])
  }
  return parsed
}
function required(values, name) { const value = values.get(name); assert.ok(value, `--${name} is required`); return value }
function inside(logicalPath) {
  assert.equal(path.isAbsolute(logicalPath), false, "project-relative path required")
  const resolved = path.resolve(ROOT, logicalPath)
  assert.ok(resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`), "path escapes project")
  return resolved
}
function sha256File(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }
function projectPath(filePath) { return path.relative(ROOT, path.resolve(filePath)).replaceAll("\\", "/") }
function bind(logicalPath) { const absolute = inside(logicalPath); return { path: projectPath(absolute), sha256: sha256File(absolute) } }
function verifyBinding(binding, role) {
  assert.ok(binding && typeof binding === "object", `${role} binding missing`)
  assert.match(binding.sha256 ?? "", /^[a-f0-9]{64}$/u, `${role} SHA-256 invalid`)
  const absolute = inside(binding.path)
  assert.equal(fs.statSync(absolute).isFile(), true, `${role} is not a file`)
  assert.equal(sha256File(absolute), binding.sha256, `${role} SHA-256 mismatch`)
  return absolute
}
function readBoundJson(binding, role) { return JSON.parse(fs.readFileSync(verifyBinding(binding, role), "utf8")) }
function writeExclusiveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
}
