// Reproduces committed ancestry. No review dispatch, failure capture or proposal execution.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { THRESHOLD } from "./ai-painter-source-correction-review-v1.mjs"
import { verifyAiPainterProgramEventCommitted } from "./ai-painter-program-event-store.mjs"
import { openStorageCatalog } from "./ai-pet-world-storage-catalog.mjs"

export const GUIDE_REVIEW_PROGRAM = "scripts/lib/ai-painter-guide-source-review.mjs"
export const GUIDE_PARENT_VERIFIER = "scripts/lib/ai-painter-guide-source-review-parent.mjs"
export const GUIDE_REVIEW_RULES = Object.freeze({ path: "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
  sha256: "6b3d3eb0c1385d8e0bede9053aa4a8bed0819613bab477f3995562175f3fa408" })
const program = GUIDE_REVIEW_PROGRAM, rules = GUIDE_REVIEW_RULES
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const firstReviewer = "a7e51c58ad35ca260d79bb23624e8baab37002decb07e4b282312b72beeaced2"
// Exact source accepted before this extraction; it used the same ancestry,
// committed-artifact and verdict reproduction checks, without a separate helper.
const previousReviewer = "df552168cdb1769f5b86a687781e1cc3a403186927e6a8b609a20e9502088b88"
export const guideSourceReviewId = payload => "source-guide-review-" + digest(JSON.stringify(payload))
const sourceReviewId = guideSourceReviewId

export function verifyGuideReviewParent({ reader, directory, recordId, imagePath, imageSha256, parentReview, checks }) {
  let next = parentReview, direct = null
  const seen = new Set(), currentProgram = digest(fs.readFileSync(fileURLToPath(new URL("./ai-painter-guide-source-review.mjs", import.meta.url))))
  while (next !== null) {
    assert(next && /^[a-f0-9]{64}$/.test(next.sha256), "explicit parent review SHA required")
    const match = /^source-guide-review-([a-f0-9]{64})\.json$/.exec(path.posix.basename(next.path))
    assert(match && next.path === directory + "/reviews/machine/" + match[0], "noncanonical parent review path")
    const id = match[0].slice(0, -5)
    assert(next.reviewId === undefined || next.reviewId === id, "parent review ID differs from its path")
    assert(!seen.has(id) && seen.size < 64, "cyclic or excessive parent review ancestry")
    seen.add(id)
    assert.equal(fs.realpathSync(next.path), path.join(fs.realpathSync(directory), "reviews", "machine", match[0]), "parent review alias")
    const prior = reader.bound(next), payload = prior.identityPayload
    assert.equal(prior.schemaVersion, "ai-assisted-cold-start-machine-review-v1")
    assert.equal(prior.reviewerType, "local_deterministic_program")
    assert.equal(prior.reviewerProgramPath, program)
    assert.equal(prior.recordId, recordId); assert.equal(payload.recordId, recordId)
    assert.equal(prior.reviewId, id); assert.equal(sourceReviewId(payload), id, "parent review content identity differs")
    assert.equal(prior.inputImageSha256, imageSha256); assert.deepEqual(prior.reviewRules, rules)
    assert.deepEqual(prior.evidencePaths, payload.evidencePaths)
    const refs = new Map(payload.evidencePaths.map(ref => [ref.path, ref]))
    assert.equal(refs.size, payload.evidencePaths.length)
    assert.equal(refs.get(imagePath)?.sha256, imageSha256)
    assert.equal(refs.get(rules.path)?.sha256, rules.sha256)
    const recordPath = directory + "/record.json", sourceRecord = reader.bound(refs.get(recordPath))
    assert.equal(sourceRecord.recordId, recordId)
    for (const binding of [sourceRecord.sourceCorrection.intakeRequest,sourceRecord.sourceCorrection.intakeEvidence,THRESHOLD]) {
      assert.equal(refs.get(binding.path)?.sha256, binding.sha256, "parent evidence belongs to another input")
      reader.bytes(binding.path,binding.sha256)
    }
    const producerSha = refs.get(program)?.sha256
    assert(producerSha === firstReviewer || producerSha === previousReviewer || producerSha === currentProgram, "unrecognized parent reviewer")
    if (producerSha === currentProgram) {
      const verifierSha = digest(fs.readFileSync(fileURLToPath(import.meta.url)))
      assert.equal(refs.get(GUIDE_PARENT_VERIFIER)?.sha256, verifierSha, "parent verifier source binding missing or changed")
      reader.bytes(GUIDE_PARENT_VERIFIER, verifierSha)
    }
    for (const [field, reportField] of [["style","styleFingerprintAudit"],["condition","semanticConditionAudit"],["frame","worldFrameIntegrityAudit"]]) {
      assert.deepEqual(prior[reportField], payload[field])
      assert.deepEqual(payload[field], checks[field], "parent " + field + " is not reproduced")
    }
    const issues = [...checks.style.issues, ...checks.condition.issues, ...checks.frame.issues]
    const passed = checks.style.passed && checks.condition.passed && checks.frame.passed && !issues.length
    assert.deepEqual(prior.issues, issues); assert.equal(prior.passed, passed)
    assert.equal(prior.status, passed ? "review_passed" : "review_failed", "parent verdict differs")
    assert.equal(prior.aiAssistedColdStartEligible, passed)
    for (const key of ["trainingEligible","runtimeEligibility","datasetReleased","independentTrainingEligible"]) assert.equal(prior[key], false)
    const link = payload.parentReview
    if (producerSha === firstReviewer) {
      assert.equal(link, null, "unverified ancestry from the legacy reviewer")
    } else {
      assert.equal(prior.reviewerProgramSha256, producerSha)
      assert.equal(payload.reviewerProgramSha256, producerSha)
      assert.deepEqual(payload.indexedSource, {recordId,recordPath,imageSha256})
      assert.equal(prior.parentReviewId, link?.reviewId ?? null)
      assert.equal(payload.parentReviewId, prior.parentReviewId)
      if (link !== null) {
        assert(link && typeof link.reviewId === "string" && link.reviewId !== id, "invalid parent reference")
        assert.equal(refs.get(link.path)?.sha256,link.sha256,"parent link missing from immutable inputs")
      }
    }
    const file = openStorageCatalog().prepare("SELECT run_id,artifact_type,sha256,byte_size,physical_uri FROM artifacts WHERE logical_path=?").get(next.path)
    assert(file && file.run_id === id && file.artifact_type === "source_machine_review" && file.sha256 === next.sha256
      && file.byte_size === fs.statSync(next.path).size && file.physical_uri === fs.realpathSync(next.path), "parent lacks its committed artifact")
    verifyAiPainterProgramEventCommitted({id,runId:id,action:"review_ai_assisted_cold_start_image",script:program,archiveId:recordId,
      evidencePath:next.path,kind:passed?"review_completed":"step_failed",status:passed?"info":"failed"})
    direct ??= {path:next.path,sha256:next.sha256,reviewId:id}
    next = link
  }
  return direct
}
