/** Read-only diagnostic of one V24 validation shadow image; never a formal gate. */
import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import sharp from "sharp"

import { auditAiAssistedConditionAlignment } from "./lib/ai-assisted-condition-alignment.mjs"
import { auditMvp256DetailSufficiency } from "./lib/ai-painter-mvp-detail-sufficiency-v1.mjs"

const ROOT = process.cwd()
const SHADOW = ".runtime/ai-painter/validation-shadow-diagnostics/v24-validation-shadow-f11497fa13a0f42d67dc9ff972d04358/result.json"
const DETAIL = "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json"
const PROGRAM = "scripts/diagnose-ai-painter-v24-shadow-semantics.mjs"
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function absolute(logical) {
  assert.equal(path.isAbsolute(logical), false, "project-relative path required")
  const target = path.resolve(ROOT, logical)
  assert.ok(target.startsWith(`${ROOT}${path.sep}`), "path escaped project")
  return target
}
function bind(logical) {
  const target = absolute(logical)
  assert.ok(fs.statSync(target).isFile(), "bound file missing")
  return { path: logical.replaceAll("\\", "/"), sha256: sha(fs.readFileSync(target)) }
}
function verify(binding) {
  assert.match(binding?.sha256 ?? "", /^[0-9a-f]{64}$/u, "bound digest invalid")
  assert.equal(bind(binding.path).sha256, binding.sha256, `source changed: ${binding.path}`)
  return absolute(binding.path)
}
function json(binding) { return JSON.parse(fs.readFileSync(verify(binding), "utf8")) }
function exclusiveJson(target, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
  assert.ok(bytes.length < MAX_OUTPUT_BYTES, "report exceeds output cap")
  fs.writeFileSync(target, bytes, { flag: "wx" })
}

const input = bind(SHADOW)
const shadow = json(input)
assert.equal(shadow.schemaVersion, "ai-painter-v24-validation-shadow-diagnostic-v1")
assert.equal(shadow.status, "diagnostic_completed_not_visual_qualified")
assert.equal(shadow.boundary?.formalInferenceEligible, false)
assert.equal(shadow.boundary?.checkpointPromotable, false)
assert.equal(shadow.boundary?.independentChallengeResult, false)
assert.equal(shadow.boundary?.registryWritten, false)
assert.equal(shadow.subject?.split, "validation")
assert.equal(shadow.subject?.sampleId, "ai-cold-start-v7-v7-capacity-slot-189-bamboo-grove-v2")
for (const artifact of Object.values(shadow.images)) verify(artifact)
const sourceReference = verify(shadow.subject.image)
const pack = json(shadow.subject.conditionPack)
assert.equal(pack.worldId, shadow.subject.worldId)
assert.equal(pack.tick, shadow.subject.tick)
assert.equal(pack.channels?.length, 23)
assert.deepEqual(pack.channels.map(({ id, path: file, sha256 }) => ({ id, path: file, sha256 })),
  shadow.subject.channels)
for (const channel of shadow.subject.channels) verify(channel)
const contractBinding = bind(DETAIL)
const contract = json(contractBinding)
assert.equal(contract.boundary?.mayGrantFormalStage4Qualification, false)
const registry = JSON.parse(fs.readFileSync(absolute(".runtime/ai-painter/current-execution-registry/current.json")))
assert.equal(registry.activeExecution, null, "active execution cannot be audited as idle")
assert.equal(registry.latestTrainingTerminal?.runId, shadow.sourceRunId)

const program = bind(PROGRAM)
const identity = sha(Buffer.from(JSON.stringify({ input, contractBinding, program })))
const directory = absolute(`.runtime/ai-painter/validation-shadow-diagnostics/v24-semantic-shadow-${identity.slice(0, 32)}`)
assert.equal(fs.existsSync(directory), false, "diagnostic already consumed; no overwrite")

if (process.argv.includes("--check")) {
  process.stdout.write(`${JSON.stringify({ status: "semantic_preflight_only", input,
    sampleId: shadow.subject.sampleId, noImagesWritten: true, qualificationGranted: false })}\n`)
} else {
  assert.deepEqual(process.argv.slice(2), ["--execute"], "use --check or --execute")
  fs.mkdirSync(directory, { recursive: false })
  try {
    const started = performance.now()
    const normalized = path.join(directory, "nearest-1024-diagnostic-only.png")
    await sharp(verify(shadow.images["prediction.png"]), { failOn: "error" })
      .resize(1024, 768, { kernel: sharp.kernel.nearest })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toFile(normalized)
    assert.ok(fs.statSync(normalized).size < MAX_OUTPUT_BYTES, "normalized preview exceeds cap")
    const subject = pack.reviewSubject ?? {}
    const alignment = await auditAiAssistedConditionAlignment({
      record: {
        recordId: `diagnostic-${shadow.diagnosticId}`,
        conditionBinding: { conditionPackPath: shadow.subject.conditionPack.path,
          worldId: pack.worldId, tick: pack.tick,
          connectivityBlueprintPath: subject.connectivityBlueprintPath ?? null },
        rebuild64Sequence: subject.rebuild64SequenceSeriesId
          ? { seriesId: subject.rebuild64SequenceSeriesId } : undefined,
        classification: { regionalLandscapeType: subject.regionalLandscapeType ?? null,
          monsoonSeason: subject.monsoonSeason ?? pack.classification?.monsoonSeason ?? null },
      },
      imagePath: normalized,
      referenceImagePath: sourceReference,
    })
    const detail = await auditMvp256DetailSufficiency({
      candidatePath: verify(shadow.images["prediction.png"]),
      referencePath: verify(shadow.images["original.png"]),
      contract,
    })
    verify(input)
    verify(shadow.subject.conditionPack)
    verify(shadow.subject.image)
    for (const channel of shadow.subject.channels) verify(channel)
    const elapsedSeconds = (performance.now() - started) / 1000
    const report = {
      schemaVersion: "ai-painter-v24-validation-shadow-semantic-diagnostic-v1",
      status: "diagnostic_completed_not_formal_qualified",
      diagnosticId: `v24-semantic-shadow-${identity.slice(0, 32)}`,
      input, program, detailContract: contractBinding,
      normalizedCandidate: { path: path.relative(ROOT, normalized).replaceAll("\\", "/"),
        sha256: sha(fs.readFileSync(normalized)),
        meaning: "nearest_projection_for_existing_diagnostic_auditor_not_native_generation" },
      conditionAlignment: alignment,
      minimumDetail: detail,
      elapsedSeconds,
      boundary: { sourceSplit: "validation", historicallyReviewedSubject: true,
        independentChallengeResult: false, formalSemanticQualified: false,
        formalStage4Qualified: false, worldEntryAllowed: false,
        checkpointPromotable: false, gpuStarted: false, optimizerSteps: 0,
        registryWritten: false, originalImageModified: false },
      recordedAtUtc: new Date().toISOString(),
    }
    assert.ok(fs.statSync(normalized).size + Buffer.byteLength(JSON.stringify(report)) < MAX_OUTPUT_BYTES,
      "semantic diagnostic output exceeds cap")
    exclusiveJson(path.join(directory, "result.json"), report)
    process.stdout.write(`${JSON.stringify({ report: bind(path.relative(ROOT, path.join(directory, "result.json"))),
      alignmentStatus: alignment.status, issueCodes: alignment.issues.map(item => item.code),
      objectStatuses: alignment.objectSemanticAudits.map(item => ({ role: item.channelId,
        status: item.status, issues: item.issues.map(issue => issue.code) })),
      detailStatus: detail.status, detailRatios: detail.ratios })}\n`)
  } catch (error) {
    exclusiveJson(path.join(directory, "failure.json"), { status: "diagnostic_failed_closed",
      error: String(error), recordedAtUtc: new Date().toISOString(),
      optimizerSteps: 0, registryWritten: false })
    throw error
  }
}
