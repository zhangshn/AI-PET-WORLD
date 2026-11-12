import { GUIDE_REVIEW_PROGRAM as program, GUIDE_REVIEW_RULES as rules, GUIDE_PARENT_VERIFIER, guideSourceReviewId as sourceReviewId, verifyGuideReviewParent } from "./ai-painter-guide-source-review-parent.mjs"
export { verifyGuideReviewParent } from "./ai-painter-guide-source-review-parent.mjs"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash, randomUUID } from "node:crypto"
import { createReader } from "./ai-painter-stage4-dataset-audit.mjs"
import { THRESHOLD } from "./ai-painter-source-correction-review-v1.mjs"
import { verifyGuideOnlySourceCorrection } from "./ai-painter-source-correction-intake-v2.mjs"
import { auditStyleFeatures, extractStyleFeatures } from "./ai-assisted-style-fingerprint.mjs"
import { auditAiAssistedConditionAlignment } from "./ai-assisted-condition-alignment.mjs"
import { auditCompleteMapWorldFrameIntegrity } from "./complete-map-world-frame-integrity.mjs"
import { appendAiPainterProgramEvent } from "./ai-painter-program-event-store.mjs"
import { indexArtifact } from "./ai-pet-world-storage-catalog.mjs"

const library = "data/world-samples/original-image-library/natural-home-v1"
const digest = bytes => createHash("sha256").update(bytes).digest("hex")

// Validate each committed ancestor without copying its verdict to the new review.


// Store identical reviewer inputs and results once, including a failed review.
function writeResult(filename, bytes) {
  const temp = filename + "." + randomUUID() + ".tmp"
  fs.writeFileSync(temp, bytes, { flag: "wx", flush: true })
  try {
    try { fs.linkSync(temp, filename) }
    catch (error) { if (error.code !== "EEXIST") throw error }
    assert(fs.readFileSync(filename).equals(bytes), "existing review conflicts with recomputed result")
  } finally { fs.unlinkSync(temp) }
}

export async function reviewGuideSource({ recordId, parentReview = null }) {
  assert(/^[a-z0-9][a-z0-9_-]{1,95}$/.test(recordId), "invalid source id")
  const root = process.cwd(), reader = createReader(root)
  const directory = library + "/complete-maps/" + recordId, recordPath = directory + "/record.json"
  const record = reader.json(recordPath)
  assert.equal(record.recordId, recordId); assert.equal(record.recordPath, recordPath)
  assert.equal(record.relativeDirectory, directory); assert.equal(record.categoryId, "complete-maps")
  assert.equal(record.sourceCorrection?.schemaVersion, "source-correction-original-record-v1")
  assert.equal(record.status, "ai_assisted_cold_start_intake")
  assert.equal(record.independentTrainingEligible, false); assert.equal(record.aiAssistedColdStartEligible, false)
  const index = reader.json(library + "/index.json").records.filter(row => row.recordId === recordId)
  assert.equal(index.length, 1); assert.equal(index[0].recordPath, recordPath)
  assert.equal(index[0].originalImage.sha256, record.originalImage.sha256)
  const request = reader.bound(record.sourceCorrection.intakeRequest)
  const receipt = reader.bound(record.sourceCorrection.intakeEvidence)
  assert.equal(request.recordId, recordId)
  const verified = await verifyGuideOnlySourceCorrection({ root, request })
  const { checkedAtUtc: storedAt, ...stored } = receipt
  const { checkedAtUtc: checkedAt, ...current } = verified.receipt
  assert(Number.isFinite(Date.parse(storedAt)) && Number.isFinite(Date.parse(checkedAt)))
  assert.deepEqual(stored, current, "archived intake evidence differs from source replay")
  for (const field of ["classification","conditionBinding","worldBinding","aiAssistedColdStart"])
    assert.deepEqual(record[field], request[field], field + " differs")
  const imagePath = directory + "/" + record.originalImage.path
  reader.bytes(imagePath, receipt.image.sha256)
  assert.equal(record.originalImage.sha256, receipt.image.sha256)
  reader.bytes(rules.path, rules.sha256)
  const threshold = reader.bound(THRESHOLD), fingerprint = reader.bound(threshold.styleFingerprint)
  assert.equal(threshold.activation.formalReviewExecutionAllowed, false)
  for (const key of ["conditionAlignment","styleFeatureExtractor"])
    reader.bytes(threshold.implementationProvenance[key].path, threshold.implementationProvenance[key].sha256)
  for (const file of [program,GUIDE_PARENT_VERIFIER,"scripts/lib/complete-map-world-frame-integrity.mjs", ...receipt.programBindings.map(b=>b.path)])
    reader.bytes(file)
  const features = await extractStyleFeatures(imagePath)
  assert.equal(features.imageSha256, receipt.image.sha256)
  const style = auditStyleFeatures(features, fingerprint)
  const condition = await auditAiAssistedConditionAlignment({ record, imagePath })
  const frame = await auditCompleteMapWorldFrameIntegrity({ record, imagePath })
  const parent = verifyGuideReviewParent({reader,directory,recordId,imagePath,imageSha256:receipt.image.sha256,
    parentReview,checks:{style,condition,frame}})
  const issues = [...style.issues,...condition.issues,...frame.issues]
  const passed = style.passed && condition.passed && frame.passed && issues.length === 0
  reader.verifyStable(); verified.verifyStable()
  // Check the live index above, but key this review on this record's membership,
  // so unrelated future insertions do not change repeat-review identity.
  const evidencePaths = reader.receipts().filter(r => r.path !== library + "/index.json")
  const reviewerProgramSha256 = evidencePaths.find(r => r.path === program).sha256
  assert.equal(reviewerProgramSha256, digest(fs.readFileSync(fileURLToPath(import.meta.url))))
  const parentReviewId = parent?.reviewId ?? null
  const identityPayload = {recordId,evidencePaths,indexedSource:{recordId,recordPath,imageSha256:receipt.image.sha256},
    reviewerProgramSha256,parentReview:parent,parentReviewId,style,condition,frame}
  const reviewId = sourceReviewId(identityPayload)
  const report = { schemaVersion:"ai-assisted-cold-start-machine-review-v1", reviewId, recordId, identityPayload,
    reviewerType:"local_deterministic_program", reviewerProgramPath:program, reviewerProgramSha256, parentReviewId, inputImageSha256:receipt.image.sha256,
    reviewRules:rules, styleFingerprintAudit:style, semanticConditionAudit:condition, worldFrameIntegrityAudit:frame,
    evidencePaths, issues, passed, status:passed?"review_passed":"review_failed", trainingEligible:false,
    runtimeEligibility:false, datasetReleased:false, aiAssistedColdStartEligible:passed, independentTrainingEligible:false }
  const reviewPath = directory + "/reviews/machine/" + reviewId + ".json"
  for (const name of ["reviews","reviews/machine"]) {
    const dir = path.resolve(directory,name)
    fs.mkdirSync(dir,{recursive:true})
    assert.equal(fs.realpathSync(dir),path.resolve(fs.realpathSync(directory),name))
  }
  const bytes = Buffer.from(JSON.stringify(report,null,2)+"\n")
  writeResult(reviewPath,bytes)
  indexArtifact({ logicalPath:reviewPath, physicalUri:fs.realpathSync(reviewPath), storageLayer:"hot",
    runId:reviewId, artifactType:"source_machine_review", byteSize:bytes.length,
    modifiedAtUtc:fs.statSync(reviewPath).mtime.toISOString(),sha256:digest(bytes) })
  const event = appendAiPainterProgramEvent({id:reviewId,action:"review_ai_assisted_cold_start_image",runId:reviewId,
    kind:passed?"review_completed":"step_failed",status:passed?"info":"failed",script:program,archiveId:recordId,
    title:"Guide-conditioned train source review",titleZh:"同一训练图纠错来源审核",detail:"Retained source components recomputed",
    detailZh:passed?"风格、条件响应和画幅审核通过。":"来源分项未通过，失败记录已保存。",
    currentStep:"reviewing",evidencePath:reviewPath,error:passed?null:issues[0]?.code,finalGameMapSuccess:false,canEnterWorld:false})
  const reviewSha256 = digest(bytes)
  const result = {...report,reviewPath,reviewSha256,ledgerEventId:event.id}
  if (!passed) {
    const { captureGuideSourceFailure } = await import("./ai-painter-guide-source-failure.mjs")
    result.failureCase = await captureGuideSourceFailure({recordId,reviewPath,reviewSha256})
  }
  return result
}
